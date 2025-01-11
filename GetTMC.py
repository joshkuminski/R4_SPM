import requests
import pyodbc
from datetime import datetime, timedelta
from config import Mio_config


def connect_to_db(server, database):
    """
    Connect to the SQL Server database.

    Returns:
        pyodbc.Connection: A connection object.
    """
    conn_str = f"""
    DRIVER={{ODBC Driver 17 for SQL Server}};
    SERVER={server};
    DATABASE={database};
    Trusted_Connection=yes;
    """
    return pyodbc.connect(conn_str)


def fetch_tmc_data(api_key, intersection_id, date):
    """
    Fetches the Turning Movement Count (TMC) data for a specific intersection and date.

    Args:
        api_key (str): Miovision API key.
        intersection_id (str): Intersection ID.
        date (str): Date in YYYY-MM-DD format.

    Returns:
        list: TMC data as a list of dictionaries or None if an error occurs.
    """
    base_url = f"https://api.miovision.com/intersections/{intersection_id}/tmc"
    headers = {
        "Authorization": f"{api_key}",
        "Content-Type": "application/json"
    }
    params = {
        "startTime": f"{date}T00:00",
        "endTime": f"{date}T24:00"
    }

    try:
        response = requests.get(base_url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()  # Adjust based on the actual API response structure
    except requests.exceptions.RequestException as e:
        print(f"Error fetching TMC data for intersection {intersection_id} on {date}: {e}")
        return None


def create_intersection_table(conn, intersection_id):
    """
    Creates a new table for the intersection if it does not exist.

    Args:
        conn (pyodbc.Connection): SQL Server database connection.
        intersection_id (str): Intersection ID.
    """
    cursor = conn.cursor()
    table_name = f"tmc_{intersection_id.replace('-', '_')}"  # Sanitize table name
    cursor.execute(f"""
    IF NOT EXISTS (
        SELECT 1
        FROM sys.tables
        WHERE name = '{table_name}'
    )
    BEGIN
        CREATE TABLE {table_name} (
            id INT IDENTITY PRIMARY KEY,
            timestamp DATETIME,
            class NVARCHAR (50),
            entrance NVARCHAR (50),
            [exit] NVARCHAR (50),
            movement NVARCHAR (50),
            qty INT NOT NULL
        )
    END
    """)
    conn.commit()


def determine_movement(entrance, exit):
    movements = {
        "N": {"S": "SBT", "W": "SBR", "E": "SBL"},
        "S": {"N": "NBT", "W": "NBL", "E": "NBR"},
        "E": {"W": "WBT", "N": "WBR", "S": "WBL"},
        "W": {"E": "EBT", "N": "EBL", "S": "EBR"},
        "NE": {"SW": "SWBT", "NW": "SWBR", "SE": "SWBL"},
        "NW": {"SE": "SEBT", "NE": "SEBL", "SW": "SEBR"},
        "SE": {"NW": "NWBT", "NE": "NWBR", "SW": "NWBL"},
        "SW": {"NE": "NEBT", "NW": "NEBL", "SE": "NEBR"},
    }
    return movements.get(entrance, {}).get(exit, "UNKNOWN")  # Default to "UNKNOWN" if not found


def save_tmc_data_to_table(conn, intersection_id, tmc_data):
    """
    Saves TMC data to the respective intersection's table.

    Args:
        conn (pyodbc.Connection): SQL Server database connection.
        intersection_id (str): Intersection ID.
        tmc_data (list): List of TMC data dictionaries.
    """
    cursor = conn.cursor()
    table_name = f"tmc_{intersection_id.replace('-', '_')}"  # Sanitize table name

    for record in tmc_data:
        # Convert timestamp to SQL-compatible format
        timestamp = record["timestamp"]
        timestamp = timestamp.split('.')[0].replace("T", " ")  # Remove timezone for simplicity

        # Determine movement
        movement = determine_movement(record["entrance"], record["exit"])

        cursor.execute(f"""
            INSERT INTO {table_name} (timestamp, class, entrance, [exit], movement, qty)
            VALUES (?, ?, ?, ?, ?, ?)
            """, timestamp, record["class"], record["entrance"], record["exit"], movement, record["qty"])

    conn.commit()


# Main logic to create tables and fetch TMC data
if __name__ == "__main__":
    server = Mio_config['server']
    database = Mio_config['database']
    api_key = Mio_config['api_key']

    conn = connect_to_db(server, database)

    # Fetch all intersection IDs
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM miovision_intersections")
    intersections = cursor.fetchall()

    # Get the previous day's date
    previous_day = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    previous_day = "2025-01-06"
    #days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]

    #for day in days:
    #previous_day = f"2025-01-{day}"
    print(f"Gathering Data for {previous_day}...")

    for (intersection_id, name, _, _, _) in intersections:
        #print(f"Processing intersection {intersection_id}...")

        # Create a table for the intersection
        #create_intersection_table(conn, intersection_id)

        # Fetch TMC data for the previous day
        tmc_data = fetch_tmc_data(api_key, intersection_id, previous_day)

        if tmc_data:
            #print(tmc_data)
            # Save TMC data to the respective table
            save_tmc_data_to_table(conn, intersection_id, tmc_data)
            print(f"TMC data saved for intersection {intersection_id}.")
        else:
            print(f"No TMC data available for intersection {intersection_id} {name}.")

    conn.close()
