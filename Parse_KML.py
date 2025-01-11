import xml.etree.ElementTree as ET
import re
from config import Mio_config
import pyodbc
import math

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points on Earth in feet.
    """
    # Convert latitude and longitude from degrees to radians
    R = 6371000  # Earth's radius in meters
    ft_per_meter = 3.28084  # Conversion factor to feet

    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance_meters = R * c
    return distance_meters * ft_per_meter


def parse_kml_namespace(kml_path):
    # Parse the XML and register namespaces
    tree = ET.parse(kml_path)
    root = tree.getroot()

    # Extract the default namespace from the root tag
    namespace = root.tag[root.tag.find("{") + 1:root.tag.find("}")]
    ns = {'kml': namespace}

    placemarks = root.findall(".//kml:Placemark", ns)
    locations = []
    record_ids = []
    MainRte = []
    IntRte = []

    for placemark in placemarks:
        name = placemark.find("kml:name", ns)
        name_text = name.text if name is not None else "Unnamed"

        description = placemark.find(".//kml:description", ns)
        coordinates = placemark.find(".//kml:coordinates", ns)
        if description is not None:
            # Extract Record_ID from the description HTML
            match_ID = re.search(r"<td>Record_ID</td>\s*<td>(.*?)</td>", description.text)
            match_MainRte = re.search(r"<td>Main_Route_Number</td>\s*<td>(.*?)</td>", description.text)
            match_IntRte = re.search(r"<td>Intersecting_Route</td>\s*<td>(.*?)</td>", description.text)
            if match_ID:
                record_ids.append(match_ID.group(1))
            if match_MainRte:
                MainRte.append(match_MainRte.group(1))
            if match_IntRte:
                IntRte.append(match_IntRte.group(1))

        if coordinates is not None:
            lon, lat, *_ = map(float, coordinates.text.strip().split(","))

        #print((match.group(1)).split("-")[0])
        if match_ID.group(1).split("-")[0] == '04' and match_ID.group(1).split("-")[1] == '43':
            locations.append({"name": match_ID.group(1), "lat": lat, "lon": lon, "Main Rte": match_MainRte.group(1), "Intersect Rte": match_IntRte.group(1)})


    return locations

def create_table_if_not_exists(cursor, table_name):
    """
    Create the target table if it does not exist.
    """
    cursor.execute(f"""
        IF NOT EXISTS (
            SELECT 1 
            FROM sys.tables 
            WHERE name = '{table_name}'
        )
        CREATE TABLE {table_name} (
            id INT IDENTITY(1,1) PRIMARY KEY,
            name NVARCHAR(255) NOT NULL,
            latitude FLOAT NOT NULL,
            longitude FLOAT NOT NULL,
            main_route NVARCHAR(255),
            intersect_route NVARCHAR(255)
        )
    """)
    cursor.commit()

def insert_and_check_duplicates(locations, target_table, intersections_table):
    """
    Insert data into MSSMS and check for duplicates in Miovisions.intersections.
    """
    # MSSMS connection
    server = Mio_config['server']
    database = Mio_config['database']

    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"Trusted_Connection=yes;"
    )
    cursor = conn.cursor()

    # Ensure the target table exists
    create_table_if_not_exists(cursor, target_table)

    # Insert data into the target table
    for loc in locations:
        cursor.execute(f"""
            INSERT INTO {target_table} (name, latitude, longitude, main_route, intersect_route)
            VALUES (?, ?, ?, ?, ?)
        """, loc['name'], loc['lat'], loc['lon'], loc['Main Rte'], loc['Intersect Rte'])
    conn.commit()

    # Compare with existing intersections to find duplicates
    cursor.execute(f"SELECT name, latitude, longitude FROM {intersections_table}")
    existing_data = cursor.fetchall()

    duplicates = []
    for loc in locations:
        for existing in existing_data:
            distance = haversine(loc['lat'], loc['lon'], existing[1], existing[2])
            if distance <= 250:  # Check if distance is within 250 feet
                duplicates.append({
                    "new_entry": loc,
                    "existing_entry": {"name": existing[0], "latitude": existing[1], "longitude": existing[2]},
                    "distance_ft": round(distance, 2)
                })

    conn.close()
    return duplicates

def insert_and_check_duplicates_with_flag(locations, target_table, intersections_table):
    """
    Insert data into MSSMS and check for duplicates in Miovisions.intersections.
    Add a 'Miovision' column to indicate duplicates.
    """
    # MSSMS connection
    server = Mio_config['server']
    database = Mio_config['database']
    username = Mio_config['username']
    password = Mio_config['password']

    conn = pyodbc.connect(
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"Trusted_Connection=yes;"
    )
    cursor = conn.cursor()

    # Ensure the target table exists
    cursor.execute(f"""
        IF NOT EXISTS (
            SELECT 1
            FROM sys.columns
            WHERE name = 'Miovision'
              AND object_id = OBJECT_ID('{target_table}')
        )
        BEGIN
            ALTER TABLE {target_table}
            ADD Miovision BIT DEFAULT 0;
        END
    """)
    conn.commit()

    # Fetch existing intersections
    cursor.execute(f"SELECT name, latitude, longitude FROM {intersections_table}")
    existing_data = cursor.fetchall()

    # Insert data and check for duplicates
    for loc in locations:
        is_duplicate = False

        for existing in existing_data:
            distance = haversine(loc['lat'], loc['lon'], existing[1], existing[2])
            if distance <= 50:  # Check if distance is within 50 feet
                is_duplicate = True
                break

        # Insert the data with the Miovision flag
        cursor.execute(f"""
            INSERT INTO {target_table} (name, latitude, longitude, main_route, intersect_route, Miovision)
            VALUES (?, ?, ?, ?, ?, ?)
        """, loc['name'], loc['lat'], loc['lon'], loc['Main Rte'], loc['Intersect Rte'], int(is_duplicate))
    conn.commit()
    conn.close()

    return f"Data inserted with Miovision flag in {target_table}."

if __name__ == "__main__":
    # Parse KML file
    kml_file = "TrafficSignalsCurrent.kml"
    locations = parse_kml_namespace(kml_file)

    # Target MSSMS table and intersections table
    target_table_name = "all_R4_traffic_signals"
    intersections_table_name = "miovision_intersections"

    # Insert data and find duplicates
    duplicates = insert_and_check_duplicates_with_flag(locations, target_table_name, intersections_table_name)
