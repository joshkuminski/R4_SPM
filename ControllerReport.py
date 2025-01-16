import pandas as pd
import pyodbc
from config import Mio_config
from sqlalchemy import create_engine


def import_csv(file):

    if file.split('_')[1] == 'AS.csv':
        df = import_schedule(file)
        return df
    elif file.split('_')[1] == 'DP.csv':
        df = import_day_plan(file)
        return df
    else:
        df = import_standard(file)
        return df



def import_schedule(file):
    df = pd.read_csv(file, header=None, skip_blank_lines=False)

    # Function to convert Excel-style references to row-column indices
    def excel_to_index(ref):
        col = ord(ref[0].upper()) - ord('A')  # Convert column letter to index (0-based)
        row = int(ref[1:]) - 1  # Convert row number to index (0-based)
        return row, col

    # Function to extract a range of values from an Excel-style range
    def extract_range(df, range_str):
        start_ref, end_ref = range_str.split(":")  # Split the range into start and end references
        start_row, start_col = excel_to_index(start_ref)
        end_row, end_col = excel_to_index(end_ref)
        return df.iloc[start_row:end_row + 1, start_col:end_col + 1]  # Slice the DataFrame


    # Initialize a list to store the results
    pattern_months = []
    pattern_days = []

    month_range = "A2:M21"
    day_range = "N2:U21"
    day_plan = df.iloc[2:21, 54] # single column for Day Plans
    day_plan = day_plan.iloc[::2]
    day_plan = day_plan.reset_index(drop=True)

    # Extract the range as a new DataFrame
    result = extract_range(df, month_range)
    day_result = extract_range(df, day_range)


    # Iterate through the DataFrame, processing every two rows as a pair
    for i in range(0, len(result), 2):
        pattern_row = result.iloc[i]  # The first row contains the pattern and month headers
        status_row = result.iloc[i + 1]  # The second row contains ON/OFF statuses

        # Extract the pattern number (first column in the first row)
        pattern_number = pattern_row.iloc[0]

        # Extract the months where the status is ON
        months = pattern_row.iloc[1:]  # Exclude the first column (pattern number)
        statuses = status_row.iloc[1:]  # Exclude the first column (pattern number)
        on_months = months[statuses == "ON"].tolist()  # Find months with "ON"

        # Append the result to the list
        pattern_months.append({"Pattern": pattern_number, "Months_ON": on_months})

    Day_of_Week = []
    # Iterate through the DataFrame, processing every two rows as a pair
    for i in range(0, len(day_result), 2):
        pattern_row = day_result.iloc[i]  # The first row contains the pattern and month headers
        status_row = day_result.iloc[i + 1]  # The second row contains ON/OFF statuses

        # Extract the pattern number (first column in the first row)
        #pattern_number = pattern_row.iloc[0]

        # Extract the months where the status is ON
        days = pattern_row.iloc[1:]  # Exclude the first column (pattern number)
        statuses = status_row.iloc[1:]  # Exclude the first column (pattern number)
        on_days = days[statuses == "ON"].tolist()  # Find months with "ON"

        #Day_of_Week.append(statuses.tolist())
        Day_of_Week.append({"Days_ON": statuses.tolist()})

    # Convert the results to a DataFrame for easy viewing
    month_df = pd.DataFrame(pattern_months)

    day_df = pd.DataFrame(Day_of_Week)
    # Combine all tables into one
    combined_table = pd.concat([month_df, day_df, day_plan], ignore_index=True, axis=1)

    # Rename columns
    combined_table.columns = ["Schedule_Plan", "Month", "Day", "Day_Plan"]
    # Convert the list in 'Values' column to a string
    combined_table['Month'] = combined_table['Month'].apply(lambda x: ','.join(map(str, x)))
    combined_table['Day'] = combined_table['Day'].apply(lambda x: ','.join(map(str, x)))
    # Display the result
    return combined_table, None


def import_day_plan(file):
    import pandas as pd

    # Load the CSV file into a DataFrame
    df = pd.read_csv(file, header=None, skip_blank_lines=False)

    # Function to convert Excel-style references to row-column indices
    def excel_to_index(ref):
        col = ord(ref[0].upper()) - ord('A')  # Convert column letter to index (0-based)
        row = int(ref[1:]) - 1  # Convert row number to index (0-based)
        return row, col

    # Function to extract a range of values from an Excel-style range
    def extract_range(df, range_str):
        start_ref, end_ref = range_str.split(":")  # Split the range into start and end references
        start_row, start_col = excel_to_index(start_ref)
        end_row, end_col = excel_to_index(end_ref)
        return df.iloc[start_row:end_row + 1, start_col:end_col + 1]  # Slice the DataFrame

    # Specify the Excel-style ranges for all day plans
    ranges = {
        "1": "B4:D11",
        "2": "J4:L11",
        "3": "R4:T11",
        "4": "B14:D21",
        "5": "J14:L21",
        "6": "R14:T21",
    }

    combined_tables = []

    # Extract and process each range
    for day_plan, range_str in ranges.items():
        result = extract_range(df, range_str).reset_index(drop=True)
        result.columns = range(result.shape[1])
        result.insert(0, "Day_Plan", day_plan)  # Add the Day_Plan column
        combined_tables.append(result)

    # Combine all tables into one
    combined_table = pd.concat(combined_tables, ignore_index=True)
    #print(combined_table)
    # Rename columns
    combined_table.columns = ["Day_Plan", "Hour", "Min", "Action"]

    return combined_table, None


def import_standard(file):
    # Load the CSV file into a DataFrame
    df = pd.read_csv(file, header=None, skip_blank_lines=False)

    # Function to convert Excel-style references to row-column indices
    def excel_to_index(ref):
        col = ord(ref[0].upper()) - ord('A')  # Convert column letter to index (0-based)
        row = int(ref[1:]) - 1  # Convert row number to index (0-based)
        return row, col

    # Function to extract a range of values from an Excel-style range
    def extract_range(df, range_str):
        start_ref, end_ref = range_str.split(":")  # Split the range into start and end references
        start_row, start_col = excel_to_index(start_ref)
        end_row, end_col = excel_to_index(end_ref)
        return df.iloc[start_row:end_row+1, start_col:end_col+1]  # Slice the DataFrame

    # Specify the Excel-style range
    excel_range = "J3:N14"
    phaseMode = df.iloc[32, 32]
    free_range = "B2:I20"
    coord_splits = "J16:S39"

    # Extract the range as a new DataFrame
    result = extract_range(df, excel_range)
    columns = ["Pattern", "Cycle", "Offset", "Split_Num", "Sequence"]
    result.columns = columns  # Rename columns
    result = result.reset_index(drop=True)

    free_result = extract_range(df, free_range)
    free_report = free_result.transpose()

    free_columns = ["Phase", "MinGreen", "Gap", "Max1", "Max2", "Yel", "Red", "Walk", "Ped"]
    free_report = free_report.iloc[:, :-10]
    free_report.columns = free_columns  # Rename columns

    columns = ["SP1", "SP2", "SP3", "SP4", "SP5", "SP6", "SP7", "SP8"]
    free_result.columns = columns  # Rename columns


    # Ensure numeric columns are converted to numbers
    for col in free_result.columns:  # Skip the "ID" column
        free_result[col] = pd.to_numeric(free_result[col], errors="coerce")
    rows_to_add = [3, 5, 6]  # Indexes of the rows
    free_result = free_result.iloc[rows_to_add].sum()

    coord_result = extract_range(df, coord_splits)
    columns = ["Split Num","Coord_Phase","SP1", "SP2", "SP3", "SP4", "SP5", "SP6", "SP7", "SP8"]
    coord_result.columns = columns  # Rename columns
    # Filter every other row in Table 2
    coord_splits = coord_result.iloc[::2]  # Every other row starting from index 0.
    coord_splits = coord_splits.reset_index(drop=True)
    coord_splits = coord_splits.iloc[:, 2:]  # Drop the last 8 columns

    coord_phase = coord_result.iloc[1::2]  # Every other row starting from index 0
    coord_phase = coord_phase.reset_index(drop=True)
    coord_phase = coord_phase.iloc[:, 1:-8]  # Drop the last 8 columns

    # Concatenate column-wise
    combined_table = pd.concat([result, coord_phase,coord_splits], axis=1)

    empty_row = {"Pattern":["25"],  # can be set to "Free" or "25"
                 "Cycle": None,
                 "Split_Num": None,
                 "Sequence": None,
                 "Coord_Phase": None,
                 "SP1": free_result["SP1"],
                 "SP2": free_result["SP2"],
                 "SP3": free_result["SP3"],
                 "SP4": free_result["SP4"],
                 "SP5": free_result["SP5"],
                 "SP6": free_result["SP6"],
                 "SP7": free_result["SP7"],
                 "SP8": free_result["SP8"],
                 "Phase_Mode": phaseMode,
                 "Offset" : 0
                 }
    df = pd.DataFrame(empty_row)
    combined_table = pd.concat([df,combined_table], ignore_index=True)

    combined_table = combined_table[["Pattern", "Cycle", "Offset", "Split_Num", "Sequence","Coord_Phase","SP1", "SP2", "SP3", "SP4", "SP5", "SP6", "SP7", "SP8", "Phase_Mode"]]

    return combined_table, free_report


def connect_to_db(server, database):
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

    return pyodbc.connect(conn_str)

def create_table(conn, intersection_id):
    """
    Saves the list of intersections to the SQL Server database.

    Args:
        conn (pyodbc.Connection): SQL Server database connection.
        intersections (list): List of intersections from the API.
    """
    cursor = conn.cursor()

    #intersection_id = "04_43_285"

    # Create the table if it doesn't exist
    create_table_query = f"""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.tables
            WHERE name = '{intersection_id}'
        )
        BEGIN
            CREATE TABLE {intersection_id} (
                Pattern INT,
                Cycle INT,
                Split_Num INT,
                Sequence INT,
                Coord_Phase INT,
                SP1 INT,
                SP2 INT,
                SP3 INT,
                SP4 INT,
                SP5 INT,
                SP6 INT,
                SP7 INT,
                SP8 INT,
                Offset INT,
                Phase_Mode NVARCHAR(10)
            )
        END
        """
    cursor.execute(create_table_query)
    conn.commit()
    conn.close()


def load_to_db(df, server, database, table_name):
    # Connection string
    connection_string = f"mssql+pyodbc://@{server}/{database}?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

    # Create a SQLAlchemy engine
    engine = create_engine(connection_string)

    try:
        # Append the DataFrame to the SQL table
        df.to_sql(name=table_name, con=engine, if_exists="append", index=False)

        print(f"Data successfully inserted into {table_name}")
    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == "__main__":
    server = Mio_config['server']
    database = Mio_config['database']

    path = "./ControllerReport"
    #TODO - make this recursive run through all files in the folder and set the intersection id
    for file in path:
        pass

    intersection_id = "Schedule_Table_04_43_285"
    #intersection_id = "Controller_Table_04_43_493"
    #intersection_id = "Day_Plan_Table_04_43_327"
    free_table = "Free_Table_04_43_285"
    '''
    # Create New Table
    conn = connect_to_db(server, database)

    create_table(conn, intersection_id)
    '''
    file_path = "./Database_Folders/ControllerTables/04-43-285/32850_Standard.csv"
    df, df_fr = import_csv(file_path)
    #load_to_db(df, server, database, intersection_id)

    if df_fr is not None:
        load_to_db(df_fr, server, database, free_table)

    '''
    print(df)
  
    Sequence_Key = {
        "Seq_Num": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        "Phase_Seq": ["1,2,3,4,5,6,7,8", "1,2,3,4,6,5,7,8", "2,1,3,4,5,6,7,8", "2,1,3,4,6,5,7,8",
                      "1,2,3,4,5,6,8,7", "1,2,3,4,6,5,8,7", "2,1,3,4,5,6,8,7", "2,1,3,4,6,5,8,7",
                      "1,2,4,3,5,6,7,8", "1,2,4,3,6,5,7,8", "2,1,4,3,5,6,7,8", "2,1,4,3,6,5,7,8",
                      "1,2,4,3,5,6,8,7", "1,2,4,3,6,5,8,7", "2,1,4,3,5,6,8,7", "2,1,4,3,6,5,8,7"]
    }
    df = pd.DataFrame(Sequence_Key)
    print(df)
  
    
    '''