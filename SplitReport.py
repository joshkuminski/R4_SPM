import pandas as pd
import pyodbc
from config import Mio_config
from sqlalchemy import create_engine

'''
Download the Split Report for a given day as a .csv file
No need to do anything to it, this script will format and extract the data needed.

'''
def import_csv(file):
    # Load the CSV file into a DataFrame
    df = pd.read_csv(file)

    # Drop the first N rows and the last M rows
    N = 7  # Number of rows to remove from the top
    M = 12  # Number of rows to remove from the bottom

    df = df.iloc[N:-M]  # Keep all rows except the first N and last M
    df = df.dropna(how="all", axis=1)  # Delete all empty columns
    df = df.iloc[:, :-8]  # Drop the last 8 columns

    columns = ["Timestamp", "Pattern", "Cycle", "SP1_split", "SP2_split", "SP3_split",
               "SP4_split",  "SP5_split", "SP6_split", "SP7_split", "SP8_split"]
    df.columns = columns

    #print(df)

    # Convert the 'Timestamp' column from the CSV's format to the SQL format
    df['Timestamp'] = pd.to_datetime(df['Timestamp'], format='%m/%d/%Y %H:%M:%S')

    # Ensure it's in the correct format for SQL (optional, as Pandas handles this)
    df['Timestamp'] = df['Timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S')

    # Track the original columns that are split
    columns_split = []

    # Iterate over the columns (skipping timestamp)
    for col in df.columns[3:]:  # Skip the first column if it's the timestamp
        try:
            # Check if the column contains strings and has any '/' to split
            if df[col].astype(str).str.contains('/').any():
                # Split the column into two new columns
                df[[f"{col}_Part1", f"{col}_Part2"]] = df[col].astype(str).str.split('/', expand=True)
                columns_split.append(col)  # Track the original column for removal
            # Check if the column is all zeros and add a placeholder column
            elif df[col].fillna(0).eq(0).all():
                df[f"{col}_Part1"] = None
                df[f"{col}_Part2"] = None
        except Exception as e:
            print(f"Skipping column {col}: {e}")

    df = df.drop(df.iloc[:, 3:11], axis=1)

    # Rename columns
    columns = ["Timestamp", "Pattern", "Cycle", "SP1_split", "SP1_term", "SP2_split", "SP2_term", "SP3_split", "SP3_term",
               "SP4_split", "SP4_term", "SP5_split", "SP5_term", "SP6_split", "SP6_term", "SP7_split", "SP7_term",
               "SP8_split", "SP8_term"]

    # Ensure the number of columns in the list matches the DataFrame
    if len(columns) != len(df.columns):
        raise ValueError(f"The number of columns in the list ({len(columns)}) does not match the DataFrame ({len(df.columns)})")

    df.columns = columns # Rename columns
 
    # Drop duplicate timestamps (keeping the first occurrence)
    df = df.drop_duplicates(subset=['Timestamp'], keep='first')

    # Save the updated DataFrame back to a CSV
    #output_path = "filtered_file.csv"
    #df.to_csv(output_path, index=False)

    return df

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

def create_table(conn):
    """
    Saves the list of intersections to the SQL Server database.

    Args:
        conn (pyodbc.Connection): SQL Server database connection.
        intersections (list): List of intersections from the API.
    """
    cursor = conn.cursor()

    intersection_id = "04_43_485"

    # Create the table if it doesn't exist
    create_table_query = f"""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.tables
            WHERE name = 'Split_Table_{intersection_id}'
        )
        BEGIN
            CREATE TABLE Split_Table_{intersection_id} (
                Timestamp DATETIME PRIMARY KEY,
                Pattern INT,
                Cycle INT,
                SP1_split INT,
                SP1_term NVARCHAR(10),
                SP2_split INT,
                SP2_term NVARCHAR(10),
                SP3_split INT,
                SP3_term NVARCHAR(10),
                SP4_split INT,
                SP4_term NVARCHAR(10),
                SP5_split INT,
                SP5_term NVARCHAR(10),
                SP6_split INT,
                SP6_term NVARCHAR(10),
                SP7_split INT,
                SP7_term NVARCHAR(10),
                SP8_split INT,
                SP8_term NVARCHAR(10)
            )
        END
        """
    cursor.execute(create_table_query)
    conn.commit()
    conn.close()


def load_to_db(df, server, database, table_name, unique_columns=['Timestamp']):
        """
        Inserts only new rows (not already in the database) into a SQL table.

        Parameters:
            df (DataFrame): The DataFrame containing the data to be loaded.
            server (str): The SQL Server name.
            database (str): The database name.
            table_name (str): The target table name.
            unique_columns (list): List of column names used to identify unique rows.
        """
        # Connection string
        connection_string = f"mssql+pyodbc://@{server}/{database}?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

        # Create a SQLAlchemy engine
        engine = create_engine(connection_string)

        try:
            # Read the existing data from the table
            query = f"SELECT {', '.join(unique_columns)} FROM {table_name}"
            existing_data = pd.read_sql(query, con=engine)

            # Ensure data types are consistent
            for col in unique_columns:
                if col in df.columns and col in existing_data.columns:
                    if pd.api.types.is_datetime64_any_dtype(existing_data[col]):
                        df[col] = pd.to_datetime(df[col])
                    elif pd.api.types.is_object_dtype(existing_data[col]):
                        df[col] = df[col].astype(str)
                    elif pd.api.types.is_numeric_dtype(existing_data[col]):
                        df[col] = pd.to_numeric(df[col])

            # Find rows that are not already in the database
            new_data = pd.merge(df, existing_data, on=unique_columns, how='left', indicator=True)
            new_data = new_data[new_data['_merge'] == 'left_only'].drop(columns=['_merge'])

            # Insert only the new rows into the database
            if not new_data.empty:
                new_data.to_sql(name=table_name, con=engine, if_exists="append", index=False)
                print(f"New data successfully inserted into {table_name}")
            else:
                print("No new data to insert.")

        except Exception as e:
            print(f"An error occurred: {e}")


if __name__ == "__main__":
    server = Mio_config['server']
    database = Mio_config['database']
    intersection_id = "Split_Table_04_43_494"

    '''
    # Create New Table
    conn = connect_to_db(server, database)

    create_table(conn)
    '''
    file_path = "./SplitReports/SplitReport_3494_12_01_2024.csv"
    df = import_csv(file_path)

    #print(df)
    load_to_db(df, server, database, intersection_id)




