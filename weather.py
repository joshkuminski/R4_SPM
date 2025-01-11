# Import Meteostat library and dependencies
from datetime import datetime
import matplotlib.pyplot as plt
from meteostat import Point, Daily
from meteostat import Stations
from datetime import datetime
from meteostat import Hourly


def getTemperature():
    # Set time period
    start = datetime(2024, 12, 1)
    end = datetime(2024, 12, 31)

    # Create Point for
    rochester = Point(43.18875, -77.68468, 70)

    # Get daily data for 2018
    data = Daily(rochester, start, end)
    data = data.fetch()

    # Plot line chart including average, minimum and maximum temperature
    data.plot(y=['tavg', 'tmin', 'tmax'])
    plt.show()


def getStations():
    # Get nearby weather stations
    stations = Stations()
    stations = stations.nearby(43.18875, -77.68468)
    station = stations.fetch(1)

    # Print DataFrame
    print(station)


# TODO - incorporate into anomaly detection
def getHourly(lat, long, start_date, end_date):
    # Set time period
    start = datetime(2024, 12, 22)
    end = datetime(2024, 12, 22, 23, 59)

    # Get hourly data
    data = Hourly('72529', start_date, end_date)  # Greater Rochester International
    #data = Hourly('M3OTI', start, end)  # Canandaigua Airport
    #data = Hourly('72523', start, end)  # Dansville
    data = data.fetch()

    # Print DataFrame
    print(data)


if __name__ == "__main__":
    #getStations()
    getTemperature()
    getHourly()