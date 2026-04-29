import os
import sqlite3

DB_PATH = 'database/transport_local.db'

USERS = [
    ('RJ Passenger', 'test@test.com', '1234', 'Passenger'),
    ('System Admin', 'admin@test.com', 'admin123', 'Admin'),
]

VEHICLES = [
    ('BUS-101', 'Bus', 45),
    ('BUS-202', 'Bus', 45),
    ('TAXI-102', 'Taxi', 4),
    ('MOTOR-103', 'Motorcycle', 2),
    ('BUS-104', 'Bus', 45),
    ('TAXI-105', 'Taxi', 4),
    ('MOTOR-106', 'Motorcycle', 2),
    ('BUS-107', 'Bus', 45),
    ('TAXI-108', 'Taxi', 4),
    ('MOTOR-109', 'Motorcycle', 2),
]

ROUTES = [
    ('Cebu City', 'Lapu-Lapu City', 22, 120, 'BUS-101', '2026-04-06 07:00:00', '2026-04-06 07:45:00'),
    ('Cebu City', 'Mandaue City', 10, 80, 'TAXI-102', '2026-04-06 08:00:00', '2026-04-06 08:25:00'),
    ('Cebu City', 'Talisay City', 12, 90, 'MOTOR-103', '2026-04-06 09:00:00', '2026-04-06 09:20:00'),
    ('Cebu City', 'Carcar City', 40, 220, 'BUS-104', '2026-04-06 10:00:00', '2026-04-06 11:30:00'),
    ('Cebu City', 'Danao City', 36, 200, 'BUS-107', '2026-04-06 11:00:00', '2026-04-06 12:10:00'),
    ('Cebu City', 'Toledo City', 52, 260, 'BUS-104', '2026-04-06 12:00:00', '2026-04-06 13:40:00'),
    ('Cebu City', 'Oslob', 117, 480, 'BUS-107', '2026-04-06 13:00:00', '2026-04-06 15:30:00'),
    ('Cebu City', 'Moalboal', 90, 420, 'BUS-107', '2026-04-06 14:00:00', '2026-04-06 16:00:00'),
    ('Cebu City', 'Bogo City', 101, 430, 'BUS-104', '2026-04-06 15:00:00', '2026-04-06 17:10:00'),
    ('Cebu City', 'Dalaguete', 82, 380, 'BUS-101', '2026-04-07 06:00:00', '2026-04-07 08:00:00'),
    ('Cebu City', 'Bantayan', 95, 460, 'BUS-107', '2026-04-07 07:00:00', '2026-04-07 09:00:00'),
    ('Cebu City', 'Consolacion', 15, 85, 'MOTOR-103', '2026-04-07 08:00:00', '2026-04-07 08:25:00'),
    ('Cebu City', 'Asturias', 55, 240, 'BUS-104', '2026-04-07 09:00:00', '2026-04-07 10:30:00'),
    ('Cebu City', 'Liloan', 22, 95, 'MOTOR-106', '2026-04-07 10:00:00', '2026-04-07 10:35:00'),
]


def ensure_database_dir():
    if not os.path.exists('database'):
        os.makedirs('database')


def ensure_user(cursor, name, email, password, role):
    row = cursor.execute('SELECT User_ID FROM User WHERE Email = ?', (email,)).fetchone()
    if row is None:
        cursor.execute(
            'INSERT INTO User (Name, Email, Password, Role) VALUES (?, ?, ?, ?)',
            (name, email, password, role),
        )


def ensure_vehicle(cursor, plate_number, vehicle_type, capacity):
    row = cursor.execute(
        'SELECT Vehicle_ID FROM Vehicle WHERE Plate_Number = ?',
        (plate_number,),
    ).fetchone()
    if row is None:
        cursor.execute(
            'INSERT INTO Vehicle (Plate_Number, Type, Capacity) VALUES (?, ?, ?)',
            (plate_number, vehicle_type, capacity),
        )


def ensure_route(cursor, origin, destination, distance, base_fare):
    row = cursor.execute(
        'SELECT Route_ID FROM Route WHERE Origin = ? AND Destination = ?',
        (origin, destination),
    ).fetchone()
    if row is None:
        cursor.execute(
            'INSERT INTO Route (Origin, Destination, Distance, Base_Fare) VALUES (?, ?, ?, ?)',
            (origin, destination, distance, base_fare),
        )
        return cursor.lastrowid

    cursor.execute(
        'UPDATE Route SET Distance = ?, Base_Fare = ? WHERE Route_ID = ?',
        (distance, base_fare, row[0]),
    )
    return row[0]


def ensure_schedule(cursor, departure_time, arrival_time, route_id, vehicle_id):
    row = cursor.execute(
        '''
        SELECT Schedule_ID
        FROM Schedule
        WHERE Departure_Time = ? AND Route_ID = ? AND Vehicle_ID = ?
        ''',
        (departure_time, route_id, vehicle_id),
    ).fetchone()
    if row is None:
        cursor.execute(
            '''
            INSERT INTO Schedule (Departure_Time, Arrival_Time, Route_ID, Vehicle_ID)
            VALUES (?, ?, ?, ?)
            ''',
            (departure_time, arrival_time, route_id, vehicle_id),
        )


def main():
    ensure_database_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=MEMORY')
    cursor = conn.cursor()

    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS User (
        User_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Email TEXT UNIQUE NOT NULL,
        Password TEXT NOT NULL,
        Role TEXT NOT NULL CHECK(Role IN ('Passenger', 'Admin'))
    );
    CREATE TABLE IF NOT EXISTS Vehicle (
        Vehicle_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Plate_Number TEXT UNIQUE NOT NULL,
        Type TEXT NOT NULL,
        Capacity INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Route (
        Route_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Origin TEXT NOT NULL,
        Destination TEXT NOT NULL,
        Distance REAL,
        Base_Fare REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Schedule (
        Schedule_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Departure_Time DATETIME NOT NULL,
        Arrival_Time DATETIME,
        Status TEXT DEFAULT 'Scheduled',
        Route_ID INTEGER,
        Vehicle_ID INTEGER,
        FOREIGN KEY (Route_ID) REFERENCES Route(Route_ID),
        FOREIGN KEY (Vehicle_ID) REFERENCES Vehicle(Vehicle_ID)
    );
    CREATE TABLE IF NOT EXISTS Booking (
        Booking_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Booking_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
        Total_Price REAL NOT NULL,
        Status TEXT DEFAULT 'Pending',
        User_ID INTEGER,
        Schedule_ID INTEGER,
        FOREIGN KEY (User_ID) REFERENCES User(User_ID),
        FOREIGN KEY (Schedule_ID) REFERENCES Schedule(Schedule_ID)
    );
    ''')

    cursor.executescript('''
    DELETE FROM Booking;
    DELETE FROM Schedule;
    DELETE FROM Route;
    DELETE FROM Vehicle;
    DELETE FROM User;
    DELETE FROM sqlite_sequence WHERE name IN ('Booking', 'Schedule', 'Route', 'Vehicle', 'User');
    ''')

    for user in USERS:
        ensure_user(cursor, *user)

    for vehicle in VEHICLES:
        ensure_vehicle(cursor, *vehicle)

    route_id = ensure_route(cursor, 'EDSA Cubao', 'Baguio Grand Terminal', 255, 650)
    # Keep the demo schedules attached to the first route for existing test bookings.
    vehicle_id_1 = cursor.execute('SELECT Vehicle_ID FROM Vehicle WHERE Plate_Number = ?', ('BUS-101',)).fetchone()[0]
    vehicle_id_2 = cursor.execute('SELECT Vehicle_ID FROM Vehicle WHERE Plate_Number = ?', ('BUS-202',)).fetchone()[0]
    ensure_schedule(cursor, '2026-04-06 22:00:00', '2026-04-07 03:30:00', route_id, vehicle_id_1)
    ensure_schedule(cursor, '2026-04-07 06:00:00', '2026-04-07 11:00:00', route_id, vehicle_id_2)

    for origin, destination, distance, fare, plate, departure, arrival in ROUTES:
        route_id = ensure_route(cursor, origin, destination, distance, fare)
        vehicle_id = cursor.execute(
            'SELECT Vehicle_ID FROM Vehicle WHERE Plate_Number = ?',
            (plate,),
        ).fetchone()[0]
        ensure_schedule(cursor, departure, arrival, route_id, vehicle_id)

    conn.commit()
    conn.close()
    print('Database transport_local.db created with Cebu bus, taxi, and motorcycle routes.')


if __name__ == '__main__':
    main()
