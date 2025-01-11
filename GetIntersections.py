import requests
import sqlite3


def get_intersections(api_key):
    """
    Fetches the list of intersections from the Miovision API.

    Args:
        api_key (str): Your Miovision API key.

    Returns:
        list: A list of intersections or an error message.
    """
    # Base URL for Miovision API (replace with actual API base URL if different)
    base_url = "https://api.miovision.com"
    endpoint = f"{base_url}/intersections"

    # Headers with the API key for authentication
    headers = {
        "Authorization": f"{api_key}",
        "Content-Type": "application/json"
    }

    try:
        # Make the GET request
        response = requests.get(endpoint, headers=headers)

        # Check for HTTP errors
        response.raise_for_status()

        # Parse the JSON response
        intersections = response.json()
        return intersections

    except requests.exceptions.HTTPError as http_err:
        return {"error": f"HTTP error occurred: {http_err}"}
    except Exception as err:
        return {"error": f"An error occurred: {err}"}


def save_intersections_to_db(intersections, db_path="intersections.db"):
    """
    Saves the list of intersections to an SQLite database.

    Args:
        intersections (list): List of intersections from the API.
        db_path (str): Path to the SQLite database file.
    """
    # Connect to SQLite database (creates it if it doesn't exist)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create the intersections table if it doesn't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS intersections (
            id TEXT PRIMARY KEY,
            name TEXT,
            customId TEXT
        )
    """)

    # Insert intersections into the database
    for intersection in intersections:
        # Adjust fields to match the structure of your API's data
        cursor.execute("""
            INSERT OR IGNORE INTO intersections (id, name, customId)
            VALUES (?, ?, ?)
        """, (intersection.get('id'), intersection.get('name'), intersection.get('customId')))

    # Commit changes and close connection
    conn.commit()
    conn.close()


def fetch_lat_lon(api_key, intersection_id):
    """
    Fetches latitude and longitude for a specific intersection from the Miovision API.

    Args:
        api_key (str): Your Miovision API key.
        intersection_id (str): The ID of the intersection.

    Returns:
        tuple: (latitude, longitude) or None if there's an error.
    """
    base_url = f"https://api.miovision.com/intersections/{intersection_id}"
    headers = {
        "Authorization": f"{api_key}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(base_url, headers=headers)
        response.raise_for_status()
        data = response.json()
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        return latitude, longitude
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data for intersection {intersection_id}: {e}")
        return None


def update_database_with_lat_lon(api_key, db_path="intersections.db"):
    """
    Updates the database with latitude and longitude for all intersections.

    Args:
        api_key (str): Your Miovision API key.
        db_path (str): Path to the SQLite database file.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add latitude and longitude columns if they don't exist
    cursor.execute("""
        ALTER TABLE intersections ADD COLUMN latitude REAL
    """)
    cursor.execute("""
        ALTER TABLE intersections ADD COLUMN longitude REAL
    """)

    # Fetch all intersection IDs from the database
    cursor.execute("SELECT id FROM intersections")
    intersections = cursor.fetchall()

    for (intersection_id,) in intersections:
        # Fetch latitude and longitude from the API
        lat_lon = fetch_lat_lon(api_key, intersection_id)
        if lat_lon:
            latitude, longitude = lat_lon
            # Update the database with the fetched data
            cursor.execute("""
                UPDATE intersections
                SET latitude = ?, longitude = ?
                WHERE id = ?
            """, (latitude, longitude, intersection_id))
            print(f"Updated intersection {intersection_id} with lat={latitude}, lon={longitude}")

    # Commit changes and close the database connection
    conn.commit()
    conn.close()


# Example usage
if __name__ == "__main__":
    # Replace 'your_api_key_here' with your actual Miovision API key
    api_key = "7_J6IKTAlbukBQJdwON9x0G_wYq0oZyr9t3ksZy7BJH3ASEFwVjJC-I95p9Cus6i"
    '''
    CREATE DATABASE AND GET ALL INTERSECTION IDS
        intersections = get_intersections(api_key)
    
        if "error" in intersections:
            print(intersections["error"])
        else:
            # Save intersections to the database
            save_intersections_to_db(intersections)
            print("Intersections saved to database.")
            #for idx, intersection in enumerate(intersections, start=1):
            #    print(f"{idx}: {intersection}")
    '''
    '''
    # Update the database with latitude and longitude
    update_database_with_lat_lon(api_key)
    print("Database updated with latitude and longitude.")
    
    '''
