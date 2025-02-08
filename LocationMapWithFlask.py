from flask import Flask, render_template_string, request, render_template, send_file, Response, jsonify, redirect, url_for, flash
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
import json
import folium
from folium import CssLink, JavascriptLink
from folium import Element
import os
import pyodbc
from config import Mio_config
import sqlite3 # for temp storage
from Anomaly import zScore
from datetime import datetime, timedelta
import pandas as pd
from meteostat import Daily, Point, Hourly
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
import io
import string
from sqlalchemy import create_engine
import math
import numpy as np
from haversine import haversine, Unit
from UtilityFunctions import calculate_destination_point


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key_here'  # Required for session management

# Initialize Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = 'login'  # Route to redirect unauthorized users

# Dummy user data (replace with a database in production)
users = {
    'user1': {'password': 'password1'},
    'user2': {'password': 'password2'}
}

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, username):
        self.id = username

# Load user callback for Flask-Login
@login_manager.user_loader
def load_user(username):
    if username in users:
        return User(username)
    return None

# Login form
class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

# Routes
@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        username = form.username.data
        password = form.password.data

        # Check if user exists and password is correct
        if username in users and users[username]['password'] == password:
            user = User(username)
            login_user(user)
            flash('Login successful!', 'success')
            return redirect(url_for('map_page'))
        else:
            flash('Invalid username or password', 'error')

    return render_template('login.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))


# Global variable to store the database connection
db_conn = sqlite3.connect(":memory:", check_same_thread=False)
cursor = db_conn.cursor()

# Function to initialize or overwrite the temporary database
def initialize_temp_db(tmc_data):
    # Create the table structure (overwrite if it exists)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tmc_data (
            timestamp TEXT,
            NBL INTEGER,
            NBT INTEGER,
            NBR INTEGER,
            SBL INTEGER,
            SBT INTEGER,
            SBR INTEGER,
            EBL INTEGER,
            EBT INTEGER,
            EBR INTEGER,
            WBL INTEGER,
            WBT INTEGER,
            WBR INTEGER,
            Total INTEGER,
            Articulated_Total INTEGER,
            Single_Unit_Total INTEGER,
            Bus_Total INTEGER,
            Bicycle_Total INTEGER,
            Light_Total INTEGER
        )
    """)
    db_conn.commit()

    # Clear any existing data
    cursor.execute("DELETE FROM tmc_data")
    db_conn.commit()

    # Convert dictionaries to tuples
    data_tuples = [
        (
            entry["timestamp"], entry["NBL"], entry["NBT"], entry["NBR"],
            entry["SBL"], entry["SBT"], entry["SBR"], entry["EBL"],
            entry["EBT"], entry["EBR"], entry["WBL"], entry["WBT"],
            entry["WBR"], entry["Total"], entry["Articulated_Total"], 
            entry["Single_Unit_Total"], entry["Bus_Total"], entry["Bicycle_Total"],
            entry["Light_Total"]
        ) for entry in tmc_data
    ]

    # Insert new data
    cursor.executemany("""
        INSERT INTO tmc_data (
            timestamp, NBL, NBT, NBR, SBL, SBT, SBR, 
            EBL, EBT, EBR, WBL, WBT, WBR, Total, Articulated_Total, 
            Single_Unit_Total, Bus_Total, Bicycle_Total, Light_Total
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, data_tuples)

    db_conn.commit()
    #conn.close()


def connect_to_db(server, database, username=None, password=None):
    """
    Connect to the SQL Server database where TMC data is stored.

    Returns:
        pyodbc.Connection: A connection object.
    """
    conn_str = f"""
        DRIVER={{ODBC Driver 17 for SQL Server}};
        SERVER={server};
        DATABASE={database};
        Trusted_Connection=yes;
        """

    # Connection with Sql Auth
    #conn_str = f"""
    #   DRIVER={{ODBC Driver 17 for SQL Server}};
    #    SERVER={server};
    #    DATABASE={database};
    #    UID={username};
    #    PWD={password};
    #    """
    return pyodbc.connect(conn_str)


def fetch_locations_from_db():
    """
    Fetch all intersections with their latitudes and longitudes from the database.
    """
    server = Mio_config['server']
    database = Mio_config['database']
    username = Mio_config['username']
    password = Mio_config['password']

    conn = connect_to_db(server, database, username, password)

    # Fetch all intersection IDs
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM miovision_intersections")

    mio_locations = [
        {"id": row[0], "name": row[1], "latitude": row[3], "longitude": row[4], "customId": row[2]}
        for row in cursor.fetchall()
    ]

    #cursor.execute("SELECT * FROM all_R4_traffic_signals WHERE Miovision = 0 OR Miovision IS NULL")
    cursor.execute("SELECT * FROM addToMap")

    other_locations = [
        {"id": row[0], "name": row[1], "latitude": row[2], "longitude": row[3], "main_route": row[4],
         "intersect_route": row[5]}
        for row in cursor.fetchall()
    ]
    conn.close()
    return mio_locations, other_locations


def fetch_tmc_data(intersection_id, start_date=None, end_date=None):
    """
    Fetch turning movement count (TMC) data for a specific intersection.
    """
    server = Mio_config['server']
    database = Mio_config['database']
    username = Mio_config['username']
    password = Mio_config['password']
    pythonsql = "./sql/histogram.sql"

    conn = connect_to_db(server, database, username, password)
    cursor = conn.cursor()

    start_date = start_date.split(' ')[0]
    end_date = end_date.split(' ')[0]
    #print(start_date, end_date)
    # Table name is sanitized to match the expected format
    table_name = f"tmc_{intersection_id.replace('-', '_')}"  # Sanitize table name
    int_var_dict = {'intersection': table_name,
                    'start_date': start_date,
                    'end_date': end_date
                    }

    with open(pythonsql, 'r') as f:
        query = f.read()
    for placeholder, value in int_var_dict.items():  # Replaces variables in SQL with variables/values above
        query = query.replace(f'@{placeholder}', str(value))


    try:
        cursor.execute(query)
        data = cursor.fetchall()
    except pyodbc.OperationalError:
        data = []  # Handle case where table does not exist
    conn.close()

    #columns = ["timestamp", "NBL", "NBT", "NBR", "SBL", "SBT", "SBR", "EBL", "EBT", "EBR",
    #           "WBL", "WBT", "WBR", "Total"]
    column_names = ["timestamp", "NBL", "NBT", "NBR", "SBL", "SBT", "SBR", "EBL", "EBT", "EBR",
                    "WBL", "WBT", "WBR", "Total", "Articulated_Total", "Single_Unit_Total",
                    "Bus_Total", "Bicycle_Total", "Light_Total"]
    # Convert tuples to dictionaries - using column name
    tmc_data = [dict(zip(column_names, row)) for row in data]

    return tmc_data


def fetch_split_data(name, customId=None, selectDate=None):
    server = Mio_config['server']
    database = Mio_config['database']

    if customId == 'None':
        customId = name.split(' ')[0]

    table_name = f"Split_Table_{customId.replace('-', '_')}"  # Sanitize table name
    
    if selectDate:
        pythonsql = "./sql/split_monitor_TT.sql"
        int_var_dict = {'split_table': table_name,
                        'SelectedDate': selectDate
                    }
    else:
        pythonsql = "./sql/split_monitor.sql"
        int_var_dict = {'split_table': table_name
                    }

    conn = connect_to_db(server, database)
    cursor = conn.cursor()

    with open(pythonsql, 'r') as f:
        query = f.read()
    for placeholder, value in int_var_dict.items():  # Replaces variables in SQL with variables/values above
        query = query.replace(f'@{placeholder}', str(value))

    try:
        cursor.execute(query)
        data = cursor.fetchall()
    except pyodbc.OperationalError:
        data = []  # Handle case where table does not exist
    conn.close()

    column_names = ["Timestamp", "Pattern", "Cycle", "SP1_split", "SP1_term", "SP2_split", "SP2_term", "SP3_split", "SP3_term",
                    "SP4_split", "SP4_term", "SP5_split", "SP5_term", "SP6_split", "SP6_term", "SP7_split", "SP7_term",
                    "SP8_split", "SP8_term"]
    # Convert tuples to dictionaries - using column name
    split_data = [dict(zip(column_names, row)) for row in data]

    return split_data


def fetch_day_plan(selected_date, customId):
    server = Mio_config['server']
    database = Mio_config['database']

    # Connect to SQL database
    conn = connect_to_db(server, database)
    cursor = conn.cursor()

    # Parse the date
    #parsed_date = datetime.strptime(selected_date, "%Y-%m-%d")
    # TODO - need to input the months as either ON or OFF in the table
    # month_name = parsed_date.strftime("%b")  # Get month abbreviation (e.g., 'Dec')
    # Parse the selected date to get the day of the week
    parsed_date = datetime.strptime(selected_date, "%Y-%m-%d")
    day_of_week = (parsed_date.weekday() + 1) % 7 + 1  # Adjust mapping for Sunday=1, ..., Saturday=7


    # Query the SQL database to find the Day_Plan
    table = f"Schedule_Table_{customId.replace('-','_')}"
    query = f"""
        SELECT *
        FROM {table}
        """
    cursor.execute(query)
    result = cursor.fetchall()

    # Process the data
    for row in result:
        schedule_plan, months, day_statuses, day_plan = row
        day_status_list = day_statuses.split(',')  # Split 'ON,OFF,ON' into a list

        # Handle cases where day index might be out of bounds
        if len(day_status_list) >= day_of_week:
            status_for_selected_day = day_status_list[day_of_week - 1]  # Get the status for the selected day
            if status_for_selected_day == "ON":
                new_day_plan = schedule_plan
        else:
            print(f"Schedule Plan {schedule_plan}: Day {day_of_week} status not available")

    return new_day_plan, conn


def fetch_controller_actions(day_plan, conn, customId):
    cursor = conn.cursor()
    table_1 = f"Day_Plan_Table_{customId.replace('-', '_')}"
    table_2 = f"Controller_Table_{customId.replace('-', '_')}"

    # Query the SQL database to find the Day_Plan
    query = f"""
                SELECT *
                FROM {table_1}       
                JOIN {table_2}
                ON ({table_1}.Action = {table_2}.Pattern OR ({table_1}.Action = '25' AND {table_2}.Pattern = 'Free'))
                WHERE Day_Plan = {day_plan}
                ORDER BY CAST(Hour AS INT);
                """
    #print(query)
    cursor.execute(query)
    data = cursor.fetchall()

    column_names = ["Day_Plan", "Hour", "Min", "Action", "Pattern", "Cycle", "Offset", "Split_Num", "Sequence",
                    "Coord_Phase",
                    "SP1", "SP2", "SP3", "SP4", "SP5", "SP6", "SP7", "SP8", "Phase_Mode"]

    # Convert tuples to dictionaries - using column name
    tod_table = [dict(zip(column_names, row)) for row in data]

    df = pd.DataFrame(tod_table)  # convert to dataframe

    return df


def fetch_free_table(conn, customId):
    cursor = conn.cursor()
    table = f"Free_Table_{customId.replace('-', '_')}"

    # Query the SQL database to find the Day_Plan
    query = f"""
                SELECT *
                FROM {table}       
                """
    try:
        cursor.execute(query)
        data = cursor.fetchall()
    except:
        return []

    column_names = ["Phase", "MinGreen", "Gap", "Max1", "Max2", "Yel", "Red", "Walk", "Ped"]

    # Convert tuples to dictionaries - using column name
    free_table = [dict(zip(column_names, row)) for row in data]

    df = pd.DataFrame(free_table)  # convert to dataframe
    # Need to get the min split from min green + y + r
    # Ensure numeric columns are converted to numbers
    for col in df.columns:  # Skip the "ID" column
        df[col] = pd.to_numeric(df[col], errors="coerce")
        
    cols_to_add = [1, 5, 6]  # Indexes of the cols
    df["MinSplit"] = df.iloc[:, cols_to_add].sum(axis=1)  # Use axis=1 to sum rows

    MinGreen = df["MinSplit"]
    #print(MinGreen)

    return df, MinGreen


def create_folium_map(mio_locations, other_locations, output_file="map.html"):
    """
    Create an interactive map using Folium.
    """
    # Center the map around the first location or a default location
    if mio_locations:
        default_location = [mio_locations[0]["latitude"], mio_locations[0]["longitude"]]
    else:
        default_location = [43.6532, -79.3832]  # Default: Rochester

    # Create a folium map
    map_id = str(uuid.uuid4()) 
    m = folium.Map(location=default_location, zoom_start=12, id=map_id)

    # Add markers for each location
    for location in mio_locations:
        details_url = f"http://127.0.0.1:5000/intersection/{location['name']}/{location['id']}"
        split_url = f"http://127.0.0.1:5000/split_monitor/{location['name']}/{location['customId']}"
        #popup_html = f"<b>{location['name']}</b><br>ID: {location['id']}<br><a href='{details_url}' target='_blank'>View TMC Data</a>"
        popup_html = (
            f"<b>{location['name']}</b><br>ID: {location['id']}<br>"
            f"""<br><button onclick="toggleSelection({location['latitude']}, {location['longitude']}, '{location['name']}')">
            Select
            </button><br>"""
            f"<a href=\"javascript:void(0)\" onclick=\"window.open(passTimeRangeToMarker('{details_url}'), '_blank')\">View TMC Data</a><br>"
            f"<br><a href='{split_url}' target='_blank'>View Split Monitor</a>"
        )
        popup_html += f"<button onclick=\"openPanel({location['customId']}, '{location['name']}')\">Open Notepad</button>"
        folium.Marker(
            [location["latitude"], location["longitude"]],
            popup=popup_html,
            tooltip=location["name"],
            #icon=folium.Icon(color="blue", icon="info-sign")
        ).add_to(m)

    # Add red markers for Non-Miovision locations
    for loc in other_locations:
        split_url_nonMio = f"http://127.0.0.1:5000/split_monitor/{loc['name']}/{loc['name']}"
        popup_html_nonMio = (
            f"<b>{loc['name']}</b><br>Main Route: {loc['main_route']}<br>Intersect Route: {loc['intersect_route']}"
            f"""<br><button onclick="toggleSelection({loc['latitude']}, {loc['longitude']}, '{loc['name']}')">
            Select
            </button><br>"""
            f"<br><a href='{split_url_nonMio}' target='_blank'>View Split Monitor</a>"
        )
        popup_html_nonMio += f"<button onclick=\"openPanel({loc['name']}, '{loc['name']}')\">Open Notepad</button>"
        
        # popup_html = f"<b>{loc['id']}</b><br>Main Route: {loc['main_route']}<br>Intersect Route: {loc['int_route']}"
        folium.Marker(
            [loc["latitude"], loc["longitude"]],
            popup=popup_html_nonMio,
            tooltip=loc["name"],
            # icon=folium.Icon(color="red", icon="info-sign", icon_size=(5, 5))
            icon=folium.Icon(color="red")
        ).add_to(m)



        # Add custom HTML content (e.g., a header above the map)
    custom_html = Element("""
        <div id="side-panel" style="display:none; position: absolute; top: 10%; right: 0; width: 800px; height: 80%; background: white; border-left: 2px solid black; padding: 10px; z-index: 1000; overflow-y: scroll;">
            <h3 id="panel-title"></h3>
            <div id="editor" style="height: 600px; background: #f9f9f9;"></div>
            <button onclick="saveNote()">Save</button>
            <button onclick="closePanel()">Close</button>
        </div>

        <div id="time-range">
                <label for="range">Select Time Range:</label>
                <select id="range" onchange="setTimeRange(this.value)">
                    <option value="last_week" selected>Last Week</option>
                    <option value="last_month" selected>Last Month</option>
                    <option value="last_3_months">Last 3 Months</option>
                    <option value="last_6_months">Last 6 Months</option>
                    <option value="last_year">Last Year</option>
                    <option value="custom">Custom</option>
                </select>
            </div>

            <!-- Custom Date Range Inputs (Hidden by Default) -->
            <div id="custom-range-container" style="display: none; margin-top: 10px;">
                <label for="start-date">Start Date:</label>
                <input type="text" id="start-date" class="flatpickr">
                
                <label for="end-date">End Date:</label>
                <input type="text" id="end-date" class="flatpickr">
                
                <button id="apply-date-range">Apply</button>
            </div>

            <div id="add-corridor-container" style="position: absolute; top: 10px; right: 10px; z-index: 1000;">
                <button onclick="saveCorridor()" style="background-color: #007BFF; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer;">
                    Add Corridor
                </button>
                <button id="travel-time-report" onclick="TravelTimeReport()" style="background-color: #007BFF; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer;">
                    View Travel Times
                </button>
                <select id="corridor-dropdown" style="margin-top: 10px; width: 100%; padding: 5px;">
                    <option disabled selected>Loading corridors...</option>
                </select>
            </div>
       """)

    m.get_root().html.add_child(custom_html)
    m.get_root().header.add_child(CssLink('./static/folium_css.css'))

    m.add_css_link("flatpicker_css","https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css")
    m.add_css_link("quill_css","https://cdn.quilljs.com/1.3.7/quill.snow.css")
    
    m.add_js_link("flatpicker_js", "https://cdn.jsdelivr.net/npm/flatpickr")
    m.add_js_link("quill_js", "https://cdn.quilljs.com/1.3.7/quill.min.js")

    m.get_root().html.add_child(JavascriptLink('./static/folium_js.js'))

    # Save the map to an HTML file
    m.save(output_file)
    print(f"Map saved to {output_file}")


def fetch_from_temp_db():
    db_conn = sqlite3.connect(":memory:")
    cursor = db_conn.cursor()
    cursor.execute("SELECT * FROM tmc_data")
    rows = cursor.fetchall()
    #db_conn.close()
    return rows


def fetch_weather_data(lat, lon, start_date, end_date):
    """
    Fetch historical weather data using Meteostat.

    Args:
        lat (float): Latitude of the location.
        lon (float): Longitude of the location.
        start_date (datetime): Start date for weather data.
        end_date (datetime): End date for weather data.

    Returns:
        pd.DataFrame: Weather data with anomalies flagged.
    """
    # Define location
    location = Point(lat, lon)

    # Fetch daily weather data
    #weather_data = Daily(location, start_date, end_date)
    weather_data = Hourly(location, start_date, end_date)
    weather_data = weather_data.fetch()

    # Reset index for easy manipulation
    weather_data.reset_index(inplace=True)

    # Identify weather anomalies (e.g., temperature or precipitation)
    #for column in ['tavg', 'prcp']:  # Average temperature and precipitation --- tavg for daily weather
    for column in ['temp', 'prcp']:  # Average temperature and precipitation
        if column in weather_data.columns:
            mean = weather_data[column].mean()
            std = weather_data[column].std()
            weather_data[f"{column}_zscore"] = (weather_data[column] - mean) / std
            weather_data[f"{column}_is_anomaly"] = weather_data[f"{column}_zscore"].abs() > 3

    #print(weather_data)
    return weather_data


def correlate_tmc_weather(tmc_data, weather_data):
    """
    Merge TMC data with weather anomalies.

    Args:
        tmc_data (pd.DataFrame): TMC data.
        weather_data (pd.DataFrame): Weather data with anomalies flagged.

    Returns:
        pd.DataFrame: TMC data merged with weather anomalies.
    """
    # Convert timestamps to date for merging
    tmc_data['date'] = pd.to_datetime(tmc_data['timestamp']).dt.date
    weather_data['date'] = pd.to_datetime(weather_data['time']).dt.date

    # Merge on date
    merged_data = pd.merge(tmc_data, weather_data, on='date', how='left')

    # Highlight anomalies
    merged_data['weather_anomaly'] = (
        merged_data['temp_is_anomaly'].fillna(False) | merged_data['prcp_is_anomaly'].fillna(False)
    )

    return merged_data


def clustering(tmc_data):
    column_names = ["timestamp", "NBL", "NBT", "NBR", "SBL", "SBT", "SBR", "EBL", "EBT", "EBR",
                    "WBL", "WBT", "WBR", "Total", "Articulated_Total", "Single_Unit_Total",
                    "Bus_Total", "Bicycle_Total", "Light_Total"]
    # Convert data to DataFrame
    df = pd.DataFrame(tmc_data, columns=column_names)

    # Convert timestamp column to datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])   
    df['date'] = df['timestamp'].dt.date  # Extract date part (YYYY-MM-DD)

    daily_volumes = df.groupby('date').agg({'Total': 'sum'}).reset_index()

    # Rename columns for clarity
    daily_volumes.columns = ['day', 'daily_volume']

    '''
    df['month'] = df['timestamp'].dt.to_period('M')  # Extracts YYYY-MM format
    monthly_volumes = df.groupby('month').agg({
    'Total': 'sum'
    }).reset_index()

    # Convert 'month' back to datetime for plotting or further use
    monthly_volumes['month'] = monthly_volumes['month'].dt.to_timestamp()
    '''

    #scaler = StandardScaler()
    scaler = MinMaxScaler()
    daily_volumes["normalized_volume"] = scaler.fit_transform(daily_volumes[["daily_volume"]])

    # Set the number of clusters (e.g., 3)
    kmeans = KMeans(n_clusters=3, random_state=42)
    daily_volumes["cluster"] = kmeans.fit_predict(daily_volumes[["normalized_volume"]])

    return daily_volumes


def determine_direction(coords):
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1

    # Determine North-South direction
    if delta_lat > 0:
        ns_direction = "N"
    elif delta_lat < 0:
        ns_direction = "S"
    else:
        ns_direction = ""

    # Determine East-West direction
    if delta_lon > 0:
        ew_direction = "E"
    elif delta_lon < 0:
        ew_direction = "W"
    else:
        ew_direction = ""

    # Combine directions
    direction = ns_direction + ew_direction
    return direction or "Stationary"  # Return "Stationary" if no movement


def getCorridorList(corridor_id, conn):
    cursor = conn.cursor()
    table = f"Corridor_Table"

    # Query the SQL database to find the Day_Plan
    query = f"""
                    SELECT *
                    FROM {table}       
                    WHERE corridorId = {corridor_id};
                    """
    cursor.execute(query)
    data = cursor.fetchall()

    column_names = ["corridorId", "corridorName", "latitude", "longitude", "intersectionId", "name"]

    # Convert tuples to dictionaries - using column name
    corridor_table = [dict(zip(column_names, row)) for row in data]

    df_corridor = pd.DataFrame(corridor_table)  # convert to dataframe



    table = f"Travel_Time_Table_0{corridor_id}" # TODO - need to do something about the 0

    # Query the SQL database to find the Day_Plan
    query = f"""
                        SELECT *
                        FROM {table}       
                        """
    cursor.execute(query)
    data = cursor.fetchall()

    column_names = ["Timestamp", "latitude", "longitude", "runId"]

    # Convert tuples to dictionaries - using column name
    TT_table = [dict(zip(column_names, row)) for row in data]

    df_Travel_Runs = pd.DataFrame(TT_table)  # convert to dataframe

    return df_corridor, df_Travel_Runs


def fetch_SequenceKey_table(conn):
    cursor = conn.cursor()
    table = f"Sequence_Key"

    # Query the SQL database to find the Day_Plan
    query = f"""
                SELECT *
                FROM {table}       
                """
    try:
        cursor.execute(query)
        data = cursor.fetchall()
    except:
        return []

    column_names = ["Seq_Num", "Phase_Seq"]

    # Convert tuples to dictionaries - using column name
    sequence_table = [dict(zip(column_names, row)) for row in data]

    #df = pd.DataFrame(sequence_table)  # convert to dataframe

    return sequence_table


@app.route("/")
@login_required
def index():
    """
    Home page showing the interactive map.
    """
    mio_locations, other_locations = fetch_locations_from_db()
    #other locations =
    create_folium_map(mio_locations, other_locations)
    return render_template_string("<iframe src='/map' width='100%' height='600px'></iframe>")


@app.route("/map")
@login_required
def map_page():
    """
    Serve the generated map HTML.
    """
    return open("map.html").read()


@app.route('/get_corridors', methods=['GET'])
def get_corridors():
    server = Mio_config['server']
    database = Mio_config['database']

    try:
        # Connect to the database
        conn = connect_to_db(server, database)
        cursor = conn.cursor()

        query = f"""
        SELECT *
        FROM Corridor_Table
        """
        cursor.execute(query)

        corridors = [{"corridorId": row[0], "corridorName": row[1], "latitude": row[2], "longitude": row[3],
        "intersectionId": row[4]} for row in cursor.fetchall()]

        corridor_list = []
        for corridor in corridors:
            # Extract latitude and longitude for each point
            coordinates = [corridor["latitude"], corridor["longitude"]]
            corridor_list.append({
                "corridorId": corridor["corridorId"],
                "corridorName": corridor["corridorName"],
                "coordinates": coordinates
            })


        # Extract unique corridorId and corridorName
        unique_corridors = {}
        for corridor in corridors:
            unique_corridors[corridor["corridorId"]] = corridor["corridorName"]

        # Convert to a list of dictionaries to send to the web app
        unique_corridors_list = [{"corridorId": key, "corridorName": value} for key, value in unique_corridors.items()]

        conn.close()

        response_data = {
            "corridors": unique_corridors_list,
            "corridor_list": corridor_list
        }
        response_json = json.dumps(response_data)

        return Response(response_json, content_type='application/json')  # Set content type explicitly

        #return json.dumps(unique_corridors_list, default=str)

    except Exception as e:
        print(f"Error: {e}")
        return json.dumps({"error": str(e)}, default=str)



@app.route("/intersection/<name>/<intersection_id>")
@login_required
def intersection_details(intersection_id, name):
    """
    Display TMC data for a specific intersection.
    """
    time_range = request.args.get("time_range", "last_month")
    
    now = datetime.now()

    # Calculate date range based on the selected time range
    if time_range == "last_week":
        start_date = now - timedelta(days=7) # mostly for testing
    elif time_range == "last_month":
        start_date = now - timedelta(days=30)
    elif time_range == "last_3_months":
        start_date = now - timedelta(days=90)
    elif time_range == "last_6_months":
        start_date = now - timedelta(days=180)
    elif time_range == "last_year":
        start_date = now - timedelta(days=365)
    elif time_range.split(":")[0] == "custom_range":
        start_date = time_range.split(":")[1].split(',')[0]
        now = time_range.split(":")[1].split(',')[1]
    else:
        start_date = None

    # Grab the TMC data from the MSSMS database
    tmc_data = fetch_tmc_data(intersection_id, start_date=str(start_date), end_date=str(now))
    if not tmc_data:
        return f"No TMC data found for intersection ID: {intersection_id}"


    # Perform clustering
    df = pd.DataFrame(tmc_data)
    df['date'] = df['timestamp'].dt.normalize()  # Normalize to midnight
    df['date'] = pd.to_datetime(df['date']).dt.date  # Extract dates

    #daily_volumes = df.groupby('date').agg({'Total': 'sum'}).reset_index()
    daily_volumes = df.groupby('date')['Total'].sum().reset_index()

    daily_volumes['normalized_volume'] = (daily_volumes['Total'] - daily_volumes['Total'].mean()) / daily_volumes['Total'].std()

    # Use KMeans clustering for volume grouping
     # Perform clustering for 2 through 7 clusters
    for n_clusters in range(2, 8):
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        daily_volumes[f"cluster_{n_clusters}"] = kmeans.fit_predict(daily_volumes[["normalized_volume"]])

    # Prepare clusters for frontend
    clustering_results = daily_volumes.to_dict(orient='records')
    #print(clustering_results)

    
    # Store data in a temporary SQLite database - this allows the web app access during the session
    # TODO this dosent include the 'Other' column
    initialize_temp_db(tmc_data)

    # Convert to pandas DF
    df = pd.DataFrame(tmc_data)
    df['Other'] = df['Total'] - (df['Light_Total'] + df['Bicycle_Total'] + df['Bus_Total'] + df['Single_Unit_Total'] + df['Articulated_Total'])

    # Serialize to JSON
    #tmc_data_json = json.dumps(tmc_data, default=str)
    tmc_data_json = df.to_dict(orient='records')

    # Run Anomaly Detection
    anomalies = zScore(tmc_data)
    daily_anomalies_json = sorted(anomalies["daily_anomalies"].to_dict(orient="records"), key=lambda x: x['timestamp'])  # Convert anomalies to JSON format and sort by timestamp

    # Fetch weather data for the location (use actual lat/lon)
    lat, lon = 43.1887, -77.6846  # TODO : grab from intersection DB
    if time_range.split(":")[0] == "custom_range":
        start_date_weath = datetime.strptime(start_date, "%Y-%m-%d")
        end_date_weath = datetime.strptime(now, '%Y-%m-%d')
        weather_data = fetch_weather_data(lat, lon, start_date_weath, end_date_weath)
    else:
        weather_data = fetch_weather_data(lat, lon, start_date, now)


    # Correlate TMC and weather anomalies
    tmc_weather_data = correlate_tmc_weather(pd.DataFrame(tmc_data), weather_data)

    # Collect all movement-specific anomalies
    weather_anomalies = tmc_weather_data[[col for col in tmc_weather_data.columns if '_is_anomaly' in col]].any(axis=1)

    #weather_data['timestamp'] = pd.to_datetime(weather_data['timestamp'])
    weather_data['temperature_f'] = (weather_data['temp'] * 1.8) + 32

    # Resample and interpolate
    weather_data.set_index('time', inplace=True)
    weather_15min_data = weather_data.resample('15T').interpolate()

    weather_15min_data = weather_15min_data.fillna(0)
    weather_15min_data = weather_15min_data.reset_index()

    # Convert timestamp to ISO 8601 format
    weather_15min_data['time'] = weather_15min_data['time'].dt.strftime('%Y-%m-%dT%H:%M:%S')
    weather_data_json = weather_15min_data.to_dict(orient='records')

    return render_template("visual.html",
                           intersection_id=intersection_id,
                           tmc_data=json.dumps(tmc_data_json, default=str),
                           name=name,
                           anomalies=daily_anomalies_json,
                           clusters=json.dumps(clustering_results, default=str),
                           time_range = time_range,
                           weatherData = json.dumps(weather_data_json, default=str)
                           )



@app.route("/movement_details")
def movement_details():
    timestamps = request.args.getlist("timestamp")
    name = request.args.get("name")  # Fetch the intersection name from query params
    intersection_id = request.args.get("intersection_id")  # Fetch the intersection ID

    if not timestamps:
        return "No timestamps provided!", 400

    # Query the in-memory database for the selected timestamps
    cursor.execute(f"""
        SELECT * FROM tmc_data WHERE timestamp IN ({','.join(['?'] * len(timestamps))}) ORDER BY timestamp ASC
    """, timestamps)
    rows = cursor.fetchall()
    #db_conn.close()

    if not rows:
        return "No data found for the selected timestamps.", 404

    # Map rows to dictionaries
    columns = ["timestamp", "NBL", "NBT", "NBR", "SBL", "SBT", "SBR", "EBL", "EBT", "EBR",
               "WBL", "WBT", "WBR", "Total"]
    movement_data = [dict(zip(columns, row)) for row in rows]

    '''
    # Calculate totals for each column except "timestamp"
    totals = {col: sum(row[col] for row in movement_data if col != "timestamp") for col in columns if
              col != "timestamp"}
    totals["timestamp"] = "Total"  # Label the totals row
    '''

    # Calculate totals and PHF for every 4 rows
    totals_and_phf = []
    for i in range(0, len(movement_data), 4):
        chunk = movement_data[i:i + 4]
        if len(chunk) > 0:
            # Calculate totals for each column
            totals = {col: sum(entry[col] for entry in chunk) for col in columns[1:]}  # Skip 'timestamp'
            # Calculate PHF
            phf = {col: (totals[col] / (4 * max(entry[col] for entry in chunk)) if max(
                entry[col] for entry in chunk) > 0 else None)
                   for col in columns[1:]}  # Skip 'timestamp'
            totals_and_phf.append({
                "start_timestamp": chunk[0]["timestamp"],
                "end_timestamp": chunk[-1]["timestamp"],
                "totals": totals,
                "phf": {col: round(phf[col], 2) if phf[col] is not None else None for col in phf}
            })


    return render_template("movement_details.html", tmc_data=movement_data,
                           name=name,intersection_id=intersection_id, totals_and_phf=totals_and_phf)



@app.route("/export_filtered_data", methods=["POST"])
def export_filtered_data():
    """
    Export filtered TMC data to an Excel file.
    """
    filtered_data = request.json.get("filtered_data", [])
    if not filtered_data:
        return "No data to export", 400
    median_data = request.json.get("median_data", [])

    # Convert the filtered data to a Pandas DataFrame
    filt_df = pd.DataFrame(filtered_data)
    med_df = pd.DataFrame(median_data)


    # Save DataFrame to a BytesIO stream in Excel format
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        filt_df.to_excel(writer, index=False, sheet_name="Filtered Data")
        if median_data:
            med_df.to_excel(writer, index=False, sheet_name="Mean_Median Data")
    output.seek(0)

    # Send the file for download
    return send_file(
        output,
        as_attachment=True,
        download_name="export_data.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.route("/split_monitor/<name>/<customId>")
@login_required
def split_monitor(name, customId):

    # Grab the Data from the MSSMS database
    split_data = fetch_split_data(name, customId)

    if not split_data:
        return f"No Split Data found for intersection: {name}"

    # Convert to DataFrame
    df = pd.DataFrame(split_data)

    '''
    # DONT THINK I NEED THIS - I FUCKED UP ENTERING SPLIT DATA
    # Function to reorder the date components
    def reorder_datetime_format(timestamp):
        try:
            original_datetime = datetime.strptime(str(timestamp), "%Y-%d-%m %H:%M:%S")
            return original_datetime.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None  # Handle invalid formats gracefully

    # Apply the function to the column
    df['Timestamp'] = df['Timestamp'].apply(reorder_datetime_format)

    # Convert back to datetime if needed
    df['Timestamp'] = pd.to_datetime(df['Timestamp'])
    '''
    split_data_json = df.to_dict(orient='records')

    return render_template("SplitReport.html",
                           customId = json.dumps(customId,default=str),
                           split_data= json.dumps(split_data_json, default=str),
                           name = json.dumps(name,default=str),
                           )


@app.route("/getControllerData", methods=["POST"])
def getControllerData():
    selected_day = request.json.get("selected_day", [])
    custom_id = request.json.get("controller_id", [])
    name = request.json.get("name", [])

    if custom_id == "None":
        # Get from the name
        custom_id = name.split(' ')[0]

    day_plan_num, conn = fetch_day_plan(selected_day, custom_id)
    action_plan = fetch_controller_actions(day_plan_num, conn, custom_id)
    
    free_table, MinGreen = fetch_free_table(conn, custom_id)

    action_plan_json = action_plan.to_dict(orient='records')
    MinGreen_json = MinGreen.to_dict()

    #print(action_plan, free_table)
    # Create a JSON response using json.dumps
    response_data = {
        "action_plan_json": action_plan_json,
        "MinGreen": MinGreen_json
    }
    response_json = json.dumps(response_data)

    return Response(response_json, content_type='application/json')  # Set content type explicitly



@app.route('/add_corridor', methods=['POST'])
def add_corridor():
    '''Need the list of intersections, how many corridors are already created and ?'''

    try:
        data = request.json  # Retrieve data from the request
        locations = data['locations']
        corridors = 3 # This will be from the App
        corridorName = 'BHTL @ Clay to 15A' # This will be from the App

        # CLean up
        for loc in locations:
            loc['corridorId'] = corridors
            loc['corridorName'] = corridorName
            loc['name'] = loc['name'].split(' ')[0]
            if loc['name'][-1] in string.ascii_letters:
                loc['name'] = loc['name'][:-1]

        df = pd.DataFrame(locations)
        # Reorder columns to move 'CorridorId' to the first position
        df = df[['corridorName'] + [col for col in df.columns if col != 'corridorName']]
        df = df[['corridorId'] + [col for col in df.columns if col != 'corridorId']]
        # Rename a column
        df = df.rename(columns={'lat': 'latitude'})
        df = df.rename(columns={'lng': 'longitude'})
        df = df.rename(columns={'name': 'intersectionId'})

        """
        We want to input the Corridor information into the Corridor_Table
        Cloumns = CorridorId, CorridorName, intersectionId (must Match the suffix of all intersection tables),
        latitude, longitude
        Example: (1 , 'Jefferson Rd', '04-43-126', '43.06853131', '-77.43215332')

        """
        server = Mio_config['server']
        database = Mio_config['database']

        # Connection string
        connection_string = f"mssql+pyodbc://@{server}/{database}?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

        # Create a SQLAlchemy engine
        engine = create_engine(connection_string)
        table_name = 'Corridor_Table'
        
        try:
            # Append the DataFrame to the SQL table
            #TODO - uncomment net line
            #df.to_sql(name=table_name, con=engine, if_exists="append", index=False)
        
            print(f"Data successfully inserted into {table_name}")
        except Exception as e:
            print(f"An error occurred: {e}")


        return json.dumps({"message": "Corridor saved successfully."}, default=str)

    except Exception as e:
        print(f"Error: {e}")
        return json.dumps({"error": str(e)}, default=str)


@app.route("/travel_time_report")
@login_required
def travel_time_report():
    server = Mio_config['server']
    database = Mio_config['database']

    corridor_id = request.args.get("corridorId")  # Fetch the intersection ID

    conn = connect_to_db(server, database)

    df_cor, df_tt = getCorridorList(corridor_id, conn)

    # Assuming df_cor is your DataFrame and it has 'latitude' and 'longitude' columns
    first_lat, first_lon = df_cor.iloc[0]['latitude'], df_cor.iloc[0]['longitude']
    last_lat, last_lon = df_cor.iloc[-1]['latitude'], df_cor.iloc[-1]['longitude']

    distance_ft = -1000
    new_lat, new_lon = calculate_destination_point(first_lat, first_lon , last_lat, last_lon, distance_ft)


    df_cor['distance'] = df_cor.apply(
        lambda row: haversine(
            (first_lat, first_lon),
            (row['latitude'], row['longitude']),
            unit=Unit.METERS  # You can change this to METERS if needed
        ) * 3.28084,
        axis=1
    )

    # SAme to the Travel Time Data
    df_tt['distance'] = df_tt.apply(
        lambda row: haversine(
            (new_lat, new_lon),
            (row['latitude'], row['longitude']),
            unit=Unit.METERS  # You can change this to METERS if needed
        ) * 3.28084,
        axis=1
    )

    # Add back the 1000' to the TT data
    df_tt['distance'] = df_tt['distance'] - 1000

    # CALCULATE INSTANTANEOUS SPEED
    df_tt['time_diff'] = df_tt['Timestamp'].diff().dt.total_seconds()
    df_tt['distance_diff'] = df_tt['distance'].diff()
    df_tt['speed_mph'] = abs((df_tt['distance_diff'] / df_tt['time_diff']) * 0.6818)
    df_tt['speed_mph'] = df_tt['speed_mph'].fillna(0)

    df_tt.drop(columns=['distance_diff', 'time_diff'], inplace=True)

    corridor_data_json = df_cor.to_dict(orient='records')
    travelRun_data_json = df_tt.to_dict(orient='records')

    return render_template("TTpage.html",
                           corridor_data=json.dumps(corridor_data_json, default=str),
                           travel_run_data=json.dumps(travelRun_data_json, default=str),
                           )



@app.route("/getSplitData_TT", methods=["POST"])
def getSplitDataTT():
    selected_day = request.json.get("selected_day", [])
    custom_id = request.json.get("corridor_id", [])
    corridor_list = request.json.get("corridor_data", [])
    

    split_data = []
    action_data = []
    free_data = []

    Intersection_Annotations = []
    Group_Annotations = []
    Cycle_Annotations = []
    Line_Annotations = []
    Phase_Annotations = []

    for intersection in corridor_list:
        # Grab the Data from the MSSMS database
        custom_id = intersection['intersectionId']
        splits = fetch_split_data(custom_id, customId=custom_id, selectDate=selected_day)
        df_splits = pd.DataFrame(splits)
        df_splits = df_splits.fillna(0)  # Convert all Nulls to 0s

        day_plan_num, conn = fetch_day_plan(selected_day, custom_id) # Will return the Day Plan to Use
        action_plan = fetch_controller_actions(day_plan_num, conn, custom_id) 
        free_table, MinGreen = fetch_free_table(conn, custom_id)
        # Error Action plan is returning duplicate rows
        action_plan = action_plan.drop_duplicates(subset=None, keep='first', inplace=False)
        action_data_json = action_plan.to_dict(orient='records')

        Seq_Key = fetch_SequenceKey_table(conn)

        # Convert intervals to a list of start/end times
        time_intervals = []
        for i, value in enumerate(action_data_json):
            hour, minute = int(value['Hour']), int(value['Min'])
            start_time = datetime.strptime(f"{selected_day} {hour:02}:{minute:02}:00", "%Y-%m-%d %H:%M:%S")
            if i + 1 < len(action_data_json):
                next_hour = int(action_data_json[i + 1]['Hour'])
                next_minute = int(action_data_json[i + 1]['Min'])
                end_time = datetime.strptime(f"{selected_day} {next_hour:02}:{next_minute:02}:00", "%Y-%m-%d %H:%M:%S")
            else:
                end_time = datetime.strptime(f"{selected_day} 23:59:59", "%Y-%m-%d %H:%M:%S")  # Last interval goes to the end of the day

            time_intervals.append({
                "start": start_time,
                "end": end_time,
                "action": value['Action']
            })
        
        #print(time_intervals)

        # Split data into groups based on intervals
        grouped_data = []
        if splits: 
            for interval in time_intervals:
                if interval["action"] in ["Free", "25"]:
                    continue  # Skip intervals with Action == 'Free' or '25'

                group = df_splits[
                    (df_splits['Timestamp'] >= interval['start']) &
                    (df_splits['Timestamp'] < interval['end'])
                ]

                if not group.empty:
                    grouped_data.append(group.to_dict(orient='records'))

        split_data.append(grouped_data)

        Annotation_List = []
        # Create Annotation list for each split in splits
        # grouped data will have a length equal to the action_data - 2 Does not include the first and last 
        if splits: 
            Mode = action_data_json[0]['Phase_Mode']
            for i, group in enumerate(grouped_data):
                Pattern = group[i]['Pattern']
                Coord_Phase = action_data_json[i + 1]['Coord_Phase']    
                SeqNum = action_data_json[i + 1]['Sequence']   
                Seq = Seq_Key[int(SeqNum) - 1]['Phase_Seq']

                Seq_list = []
                for S in Seq.split(','):
                    Seq_list.append(int(S))
                
                Seq_list_temp = []
                if Mode == 'QSeq':
                    Seq_list_temp = Seq_list[:4]
                    Seq_list_temp.extend(Seq_list[6:])
                    Seq_list = [Seq_list_temp, Seq_list[4:6]]
                elif Mode == 'STD8':
                    Seq_list = [Seq_list[:4], Seq_list[4:]]

  
                # Create Annotation list
                color_list = ["Green", "Green_left", "Yellow", "Red"]

                for cycle in group:  # loop through each cycle - use current Seq_list
                    #for clr_id, color in enumerate(color_list):
                    
                    if int(Coord_Phase) == 2: 
                        Split1 = int(cycle[f"SP{Seq_list[0][0]}_split"]) 
                        Split2 = int(cycle[f"SP{Seq_list[0][1]}_split"]) 
                        if Split2 > 0:
                            Yel2 = int(free_table["Yel"][int(Seq_list[0][1]) - 1])
                            Red2 = int(free_table["Red"][int(Seq_list[0][1]) - 1])
                            EOG_seconds = Split1 + (Split2 - (Yel2 + Red2))
                        else:
                            EOG_seconds = Split1
                    elif int(Coord_Phase) == 6: 
                        Split1 = int(cycle[f"SP{Seq_list[1][0]}_split"]) 
                        Split2 = int(cycle[f"SP{Seq_list[1][1]}_split"]) 
                        if Split2 > 0:
                            Yel2 = int(free_table["Yel"][int(Seq_list[1][1]) - 1])
                            Red2 = int(free_table["Red"][int(Seq_list[1][1]) - 1])
                            EOG_seconds = Split1 + (Split2 - (Yel2 + Red2))
                        else:
                            EOG_seconds = Split1
                    else:
                        print("EOG not found")

                    shiftEOG = pd.Timedelta(seconds=abs(EOG_seconds))

                    start = cycle["Timestamp"] - shiftEOG

                    Green_start = start
                    phase_count = 0

                    for ph_id, phase in enumerate(Seq_list[0]):
                        if cycle[f"SP{phase}_split"] is not None:

                            if ph_id < 2:
                                Split = int(cycle[f"SP{phase}_split"]) 
                                if Split > 0:
                                    Yel = int(free_table["Yel"][int(phase) - 1])
                                    Red = int(free_table["Red"][int(phase) - 1])

                                    Gsec = Split - (Yel + Red)
                                    Ysec = Split - Red
                                    Rsec = Split

                                    end = start + pd.Timedelta(seconds=Gsec)
                                    Yel_end = start + pd.Timedelta(seconds=Ysec) 
                                    Red_end = start + pd.Timedelta(seconds=Rsec)

                                    if phase == 1: #Lefts
                                        Green_Annotation = {"start": start,
                                                            "end": end,
                                                            "color": "GreenUp"}
                                    else:
                                        Green_Annotation = {"start": start,
                                                            "end": end,
                                                            "color": "Green"}
                                    Yellow_Annotation = {"start": end,
                                                        "end": Yel_end,
                                                        "color": "Yel"}
                                    Red_Annotation = {"start": Yel_end,
                                                        "end": Red_end,
                                                        "color": "Red"}

                                    Annotation = [Green_Annotation, Yellow_Annotation, Red_Annotation]
                                    start = Red_end
                            
                                    Phase_Annotations.append({f"Phase_{phase}": Annotation})
                            else:  # All Red Interval - needs to be before the green interval
                                Split = int(cycle[f"SP{phase}_split"]) 
                                
                                if Split > 0:
                                    phase_count +=1 
                                    #end = start + pd.Timedelta(seconds=Split)
                                    if phase_count > 1:
                                        end = start
                                    else:
                                        end = Green_start

                                    start = end - pd.Timedelta(seconds=Split)

                                    Annotation = {"start": start,
                                                "end": end,
                                                "color": "AllRed"}

                                    Annotation = [Annotation]
                                    #start = end
                                    #end = start
                            
                                    Phase_Annotations.append({f"Phase_{phase}": Annotation}) 

                    Line_Annotations.append({"Line_1": Phase_Annotations})
                    Phase_Annotations = []
                    start = cycle["Timestamp"] - shiftEOG
                    Green_start = start
                    phase_count = 0

                    for ph_id, phase in enumerate(Seq_list[1]):
                        if cycle[f"SP{phase}_split"] is not None:

                            if ph_id < 2:
                                Split = int(cycle[f"SP{phase}_split"])
                                if Split > 0:
                                    Yel = int(free_table["Yel"][int(phase) - 1])
                                    Red = int(free_table["Red"][int(phase) - 1])

                                    Gsec = Split - (Yel + Red)
                                    Ysec = Split - Red
                                    Rsec = Split

                                    end = start + pd.Timedelta(seconds=Gsec)
                                    Yel_end = start + pd.Timedelta(seconds=Ysec) 
                                    Red_end = start + pd.Timedelta(seconds=Rsec)

                                    if phase == 5: #Lefts
                                        Green_Annotation = {"start": start,
                                                            "end": end,
                                                            "color": "GreenDwn"}
                                    else:
                                        Green_Annotation = {"start": start,
                                                            "end": end,
                                                            "color": "Green"}
                                    Yellow_Annotation = {"start": end,
                                                        "end": Yel_end,
                                                        "color": "Yel"}
                                    Red_Annotation = {"start": Yel_end,
                                                        "end": Red_end,
                                                        "color": "Red"}

                                    Annotation = [Green_Annotation, Yellow_Annotation, Red_Annotation]
                                    start = Red_end
                            
                                    Phase_Annotations.append({f"Phase_{phase}": Annotation})

                            else:
                                Split = int(cycle[f"SP{phase}_split"]) 
                                if Split > 0:
                                    phase_count +=1 
                                    #end = start + pd.Timedelta(seconds=Split)
                                    if phase_count > 1:
                                        end = start
                                    else:
                                        end = Green_start

                                    start = end - pd.Timedelta(seconds=Split)

                                    Annotation = {"start": start,
                                                "end": end,
                                                "color": "AllRed"}

                                    Annotation = [Annotation]
                                    #start = end
                            
                                    Phase_Annotations.append({f"Phase_{phase}": Annotation})  


                    Line_Annotations.append({"Line_2": Phase_Annotations})
                    Phase_Annotations = []

                    Cycle_Annotations.append(Line_Annotations)
                    Line_Annotations = []

                Group_Annotations.append({f"Group_{i}": Cycle_Annotations})
                Cycle_Annotations = []
               

  
        action_data.append(action_data_json)
        free_data_json = free_table.to_dict(orient='records')
        free_data.append(free_data_json)

        
        Intersection_Annotations.append({custom_id: Group_Annotations})
        Group_Annotations = []

        #print(Intersection_Annotations)
        
        '''
        TODO - Create the annotations for the split report
        1. Dont need to do if Timestamp is in the Free Range - drop all this data. 
        2. Breakup data into sections by Pattern #s or TOD 
        3. 
        '''
    
    # Convert to DataFrame
    df = pd.DataFrame(action_data)
    action_data_json = df.to_dict(orient='records')
    df = pd.DataFrame(free_data)
    free_data_json = df.to_dict(orient='records')
    df = pd.DataFrame(Seq_Key)
    key_data_json = df.to_dict(orient='records')
    #response_json = json.dumps(split_data, default=str)

    response_data = {
        "action_data": action_data_json,
        "free_data": free_data_json,
        "split_data": split_data,
        "Key": key_data_json,
        "Annotations":Intersection_Annotations
    }
    response_json = json.dumps(response_data, default=str)

    return Response(response_json, content_type='application/json')  # Set content type explicitly


# Refactored function
@app.route("/getSplitData_TT_old", methods=["POST"])
def getSplitDataTT_old():
    selected_day = request.json.get("selected_day", [])
    corridor_list = request.json.get("corridor_data", [])

    # Data containers
    split_data = []
    action_data = []
    free_data = []
    intersection_annotations = []

    # Iterate through each intersection in the corridor list
    for intersection in corridor_list:
        custom_id = intersection['intersectionId']

        # Fetch data from the database
        splits = fetch_split_data(custom_id, customId=custom_id, selectDate=selected_day)
        if not splits:
            continue

        df_splits = pd.DataFrame(splits)
        day_plan_num, conn = fetch_day_plan(selected_day, custom_id)
        action_plan = fetch_controller_actions(day_plan_num, conn, custom_id).drop_duplicates()
        free_table, MinGreen = fetch_free_table(conn, custom_id)
        seq_key = fetch_SequenceKey_table(conn)

        action_data_json = action_plan.to_dict(orient='records')

        # Convert intervals to start/end times
        time_intervals = create_time_intervals(action_data_json, selected_day)

        # Group split data based on intervals
        grouped_data = group_split_data(df_splits, time_intervals)
        split_data.append(grouped_data)

        # Create annotations for grouped data
        annotations = create_annotations(grouped_data, action_data_json, free_table, seq_key)
        intersection_annotations.append({custom_id: annotations})

        # Append data for response
        action_data.append(action_data_json)
        free_data.append(free_table.to_dict(orient='records'))

    # Prepare response data
    response_data = {
        "action_data": action_data,
        "free_data": free_data,
        "split_data": split_data,
        "Annotations": intersection_annotations
    }

    return Response(json.dumps(response_data, default=str), content_type='application/json')


@app.route('/notes/<intersection_id>', methods=['GET'])
def get_notes(intersection_id):
    server = Mio_config['server']
    database = Mio_config['database']

    if len(intersection_id) > 10:
        intersection_id = intersection_id.split(' ')[0]

    intersection_id = f"{intersection_id.replace('-', '_')}" 


    conn = connect_to_db(server, database)
    cursor = conn.cursor()
    cursor.execute("SELECT Content FROM IntersectionNotes WHERE IntersectionId = ?", intersection_id)
    row = cursor.fetchone()

    conn.close()
    return jsonify({"content": row[0] if row else ""})


@app.route('/notes', methods=['POST'])
def save_note():
    server = Mio_config['server']
    database = Mio_config['database']

    data = request.json
    intersection_id = data.get('intersectionId')
    intersection_id = f"{intersection_id.replace('-', '_')}" 
    content = data.get('content')

    conn = connect_to_db(server, database)
    cursor = conn.cursor()
    cursor.execute(
        "IF EXISTS (SELECT 1 FROM IntersectionNotes WHERE IntersectionId = ?) "
        "UPDATE IntersectionNotes SET Content = ? WHERE IntersectionId = ? "
        "ELSE INSERT INTO IntersectionNotes (IntersectionId, Content) VALUES (?, ?)",
        (intersection_id, content, intersection_id, intersection_id, content)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})


if __name__ == "__main__":
    if not os.path.exists("map.html"):
        mio_locations, other_locations = fetch_locations_from_db()
        create_folium_map(mio_locations, other_locations)
    #locations, other_locations = fetch_locations_from_db()
    #print(locations, other_locations)
    app.run(debug=True)
