import pandas as pd
import pyodbc
from pandas.core.interchange.dataframe_protocol import DataFrame

from config import Mio_config
import datetime
from LocationMapWithFlask import connect_to_db


def Test(selected_date):
    server = Mio_config['server']
    database = Mio_config['database']

    pythonsql = "./sql/controller.sql"

    # Connect to SQL database
    conn = connect_to_db(server, database)
    cursor = conn.cursor()


    # Parse the date
    parsed_date = datetime.datetime.strptime(selected_date, "%Y-%m-%d")
    #TODO - need to input the months as either ON or OFF in the table
    #month_name = parsed_date.strftime("%b")  # Get month abbreviation (e.g., 'Dec')
    # Parse the selected date to get the day of the week
    parsed_date = datetime.datetime.strptime(selected_date, "%Y-%m-%d")
    day_of_week = (parsed_date.weekday() + 1) % 7 + 1  # Adjust mapping for Sunday=1, ..., Saturday=7

    # Query the SQL database to find the Day_Plan
    query = """
    SELECT *
    FROM [Schedule_Table_04_43_126]
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
                print(schedule_plan)
        else:
            print(f"Schedule Plan {schedule_plan}: Day {day_of_week} status not available")

    # Close the connection
    conn.close()


def fetch_controller_actions(day_plan, conn, customId):
    cursor = conn.cursor()
    table_1 = f"Day_Plan_Table_{customId.replace('-','_')}"
    table_2 = f"Controller_Table_{customId.replace('-', '_')}"
    # Query the SQL database to find the Day_Plan
    query = f"""
            SELECT *
            FROM {table_1}       
            JOIN {table_2}
            ON ({table_1}.Action = {table_2}.Pattern OR ({table_1}.Action = '25' AND {table_2}.Pattern = 'FREE'))
            WHERE Day_Plan = {day_plan}
            ORDER BY CAST(Hour AS INT);
            """
    cursor.execute(query)
    data = cursor.fetchall()
    column_names = ["Day_Plan", "Hour", "Min", "Action","Pattern", "Cycle", "Offset","Split_Num", "Sequence", "Coord_Phase",
                    "SP1", "SP2", "SP3", "SP4", "SP5", "SP6", "SP7", "SP8", "Phase_Mode"]


    # Convert tuples to dictionaries - using column name
    tod_table = [dict(zip(column_names, row)) for row in data]

    df = pd.DataFrame(tod_table) #convert to dataframe

    return df


if __name__ == "__main__":
    # Example selected date from web page
    selected_date = "2024-12-03"  # Format: YYYY-MM-DD

    server = Mio_config['server']
    database = Mio_config['database']

    # Connect to SQL database
    conn = connect_to_db(server, database)

    #Test(selected_date)
    day_plan = "1"
    customId = "04-43-126"
    result = fetch_controller_actions(day_plan, conn, customId)
    print(result)