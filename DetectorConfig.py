import pandas as pd
from config import Mio_config
from sqlalchemy import create_engine


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

    file_path = "./Detector Configs/04-43-285 Detector Config.csv"
    df = pd.read_csv(file_path, skip_blank_lines=True)
    # Drop rows where all columns are NaN
    df = df.dropna(how='all')

    df['Detector'] = df['Detector'].astype(int)
    df['Phase'] = df['Phase'].astype(int)

    print(df)
    table = "Detector_Config_04_43_285"
    load_to_db(df, server, database, table_name=table)
