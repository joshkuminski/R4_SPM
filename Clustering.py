import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from config import Mio_config
import pyodbc

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


if __name__ == "__main__":
    server = Mio_config['server']
    database = Mio_config['database']
    pythonsql = "./sql/cluster.sql"

    conn = connect_to_db(server, database)
    cursor = conn.cursor()

    int_var_dict = {'intersection': "tmc_06ce283b_07c1_4782_81c2_4698a6f28483",
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

    # Assuming data is a list of `pyodbc.Row` objects
    data = [(row[0], row[1]) for row in data]  # Unpack into tuples of (day, volume)

    # Create DataFrame
    daily_volumes = pd.DataFrame(data, columns=["day", "daily_volume"])

    scaler = StandardScaler()
    daily_volumes["normalized_volume"] = scaler.fit_transform(daily_volumes[["daily_volume"]])

    # Set the number of clusters (e.g., 3)
    kmeans = KMeans(n_clusters=3, random_state=42)
    daily_volumes["cluster"] = kmeans.fit_predict(daily_volumes[["normalized_volume"]])

    print(daily_volumes)
