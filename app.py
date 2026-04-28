from flask import Flask, render_template, request, redirect, session, url_for
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
import sqlite3
import os
from datetime import date
from urllib.parse import quote_plus

app = Flask(__name__)
app.secret_key = 'capstone_secret_key'
DB_PATH = os.path.join('database', 'transport_local.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def load_dashboard_data():
    conn = get_db_connection()
    routes = conn.execute(
        '''
        SELECT DISTINCT Origin, Destination
        FROM Route
        ORDER BY Origin, Destination
        '''
    ).fetchall()
    transport_modes = conn.execute(
        '''
        SELECT DISTINCT Type
        FROM Vehicle
        WHERE Type IN ('Bus', 'Taxi', 'Motorcycle')
        ORDER BY CASE Type
            WHEN 'Bus' THEN 1
            WHEN 'Taxi' THEN 2
            WHEN 'Motorcycle' THEN 3
            ELSE 4
        END
        '''
    ).fetchall()
    popular_routes = conn.execute(
        '''
        SELECT
            r.Route_ID,
            r.Origin,
            r.Destination,
            r.Base_Fare,
            v.Type,
            MIN(s.Departure_Time) AS Next_Departure,
            MIN(s.Arrival_Time) AS Next_Arrival
        FROM Route r
        JOIN Schedule s ON s.Route_ID = r.Route_ID
        LEFT JOIN Vehicle v ON v.Vehicle_ID = s.Vehicle_ID
        WHERE v.Type IN ('Bus', 'Taxi', 'Motorcycle')
        GROUP BY r.Route_ID, r.Origin, r.Destination, r.Base_Fare, v.Type
        ORDER BY r.Base_Fare ASC
        LIMIT 6
        '''
    ).fetchall()
    conn.close()

    locations = sorted({route['Origin'] for route in routes} | {route['Destination'] for route in routes})
    metro_locations = [
        'Cebu City',
        'Mandaue City',
        'Lapu-Lapu City',
        'Talisay City',
        'Consolacion',
        'Liloan',
    ]
    modes = [mode['Type'] for mode in transport_modes]
    return locations, metro_locations, modes, popular_routes


def build_google_maps_url(origin, destination):
    return (
        'https://www.google.com/maps/dir/?api=1'
        f'&origin={quote_plus(f"{origin}, Cebu, Philippines")}'
        f'&destination={quote_plus(f"{destination}, Cebu, Philippines")}'
        '&travelmode=driving'
    )

# Initialize OAuth
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id='YOUR_GOOGLE_CLIENT_ID',
    client_secret='YOUR_GOOGLE_CLIENT_SECRET',
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://openidconnect.googleapis.com/v1/userinfo',
    client_kwargs={'scope': 'openid email profile'},
)



@app.route('/login/google')
def google_login():
    redirect_uri = url_for('google_auth', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/callback')
def google_auth():
    token = google.authorize_access_token()
    user_info = google.get('userinfo').json()
    # Here you would check if the user exists in your database 
    # If not, create a new GoRoute account for them!
    session['user'] = user_info['email']
    return redirect(url_for('dashboard'))

# --- 1. LOGIN ROUTE ---
@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM User WHERE Email = ?', (email,)).fetchone()
        conn.close()
        
        if user and user['Password'] == password:
            session['user_id'] = user['User_ID']
            session['name'] = user['Name']
            session['role'] = user['Role'] # Save their role!
            
            # Send them to the right screen based on their role
            if session['role'] == 'Admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('dashboard')) 
        else:
            return "Invalid credentials. Try again."
            
    return render_template('login.html')

# --- SIGN UP ROUTE ---
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        
        conn = get_db_connection()
        
        # Check if the email is already registered
        existing_user = conn.execute('SELECT * FROM User WHERE Email = ?', (email,)).fetchone()
        
        if existing_user:
            conn.close()
            return "Email already exists! Please go back and try a different one."
            
        # Save the new user as a 'Passenger'
        conn.execute(
            'INSERT INTO User (Name, Email, Password, Role) VALUES (?, ?, ?, ?)',
            (name, email, password, 'Passenger')
        )
        conn.commit()
        conn.close()
        
        # Send them back to the login page to sign in
        return redirect(url_for('login'))
        
    return render_template('signup.html')

# --- ADMIN DASHBOARD ROUTE ---
@app.route('/admin_dashboard')
def admin_dashboard():
    # --- DEVELOPER BYPASS FOR VS CODE PREVIEW ---
    # If the previewer deletes the cookie, force an Admin session
    if 'user_id' not in session:
        session['user_id'] = 2
        session['name'] = "System Admin (Preview Mode)"
        session['role'] = 'Admin'
    # --------------------------------------------

    # Security check: Only Admins allowed here
    if session.get('role') != 'Admin':
        return redirect(url_for('login'))
        
    return render_template('admin_dashboard.html', name=session.get('name'))


@app.route('/admin/routes', methods=['GET', 'POST'])
def admin_routes():
    if 'user_id' not in session:
        session['user_id'] = 2
        session['name'] = "System Admin (Preview Mode)"
        session['role'] = 'Admin'

    if session.get('role') != 'Admin':
        return redirect(url_for('login'))

    conn = get_db_connection()
    message = None

    if request.method == 'POST':
        action = request.form.get('action', 'save')
        route_id = request.form.get('route_id')
        origin = request.form.get('origin', '').strip()
        destination = request.form.get('destination', '').strip()
        distance = request.form.get('distance', '').strip()
        base_fare = request.form.get('base_fare', '').strip()

        if action == 'delete' and route_id:
            schedule_ids = [
                row['Schedule_ID']
                for row in conn.execute(
                    'SELECT Schedule_ID FROM Schedule WHERE Route_ID = ?',
                    (route_id,)
                ).fetchall()
            ]
            if schedule_ids:
                placeholders = ','.join('?' for _ in schedule_ids)
                conn.execute(
                    f'DELETE FROM Booking WHERE Schedule_ID IN ({placeholders})',
                    schedule_ids
                )
                conn.execute(
                    f'DELETE FROM Schedule WHERE Schedule_ID IN ({placeholders})',
                    schedule_ids
                )
            conn.execute('DELETE FROM Route WHERE Route_ID = ?', (route_id,))
            conn.commit()
            message = 'Route deleted.'
        elif origin and destination and distance and base_fare:
            if route_id:
                conn.execute(
                    '''
                    UPDATE Route
                    SET Origin = ?, Destination = ?, Distance = ?, Base_Fare = ?
                    WHERE Route_ID = ?
                    ''',
                    (origin, destination, distance, base_fare, route_id)
                )
                message = 'Route updated.'
            else:
                conn.execute(
                    '''
                    INSERT INTO Route (Origin, Destination, Distance, Base_Fare)
                    VALUES (?, ?, ?, ?)
                    ''',
                    (origin, destination, distance, base_fare)
                )
                message = 'Route added.'
            conn.commit()

    edit_id = request.args.get('edit_id')
    edit_route = None
    if edit_id:
        edit_route = conn.execute(
            'SELECT * FROM Route WHERE Route_ID = ?',
            (edit_id,)
        ).fetchone()

    routes = conn.execute(
        '''
        SELECT Route_ID, Origin, Destination, Distance, Base_Fare
        FROM Route
        ORDER BY Origin, Destination
        '''
    ).fetchall()
    conn.close()

    return render_template(
        'admin_routes.html',
        name=session.get('name'),
        routes=routes,
        edit_route=edit_route,
        message=message
    )

# --- LOGOUT ROUTE ---
@app.route('/logout')
def logout():
    session.clear() # This destroys the cookie
    return redirect(url_for('login'))

# --- 2. DASHBOARD ROUTE ---
@app.route('/dashboard')
def dashboard():
    # Developer Bypass for VS Code Preview
    if 'user_id' not in session:
        session['user_id'] = 1
        session['name'] = "RJ (Preview Mode)"
        session['role'] = 'Passenger'

    locations, metro_locations, transport_modes, popular_routes = load_dashboard_data()
    display_name = session.get('name') or session.get('user') or "Passenger"
    default_date = date.today().isoformat()
        
    return render_template(
        'dashboard.html',
        name=display_name,
        locations=locations,
        metro_locations=metro_locations,
        transport_modes=transport_modes,
        popular_routes=popular_routes,
        default_date=default_date
    )

# --- 3. SEARCH ROUTE ---
@app.route('/search')
def search():
    origin = request.args.get('origin')
    destination = request.args.get('destination')
    trip_date = request.args.get('trip_date')
    transport_mode = request.args.get('transport_mode', 'All')
    
    conn = get_db_connection()
    query = '''
        SELECT s.Schedule_ID, s.Departure_Time, s.Arrival_Time,
               r.Base_Fare, v.Type, v.Plate_Number,
               r.Origin, r.Destination
        FROM Schedule s
        JOIN Route r ON s.Route_ID = r.Route_ID
        LEFT JOIN Vehicle v ON s.Vehicle_ID = v.Vehicle_ID
        WHERE r.Origin = ? AND r.Destination = ?
          AND v.Type IN ('Bus', 'Taxi', 'Motorcycle')
    '''
    params = [origin, destination]

    if transport_mode and transport_mode != 'All':
        query += ' AND v.Type = ?'
        params.append(transport_mode)

    if trip_date:
        query += ' AND DATE(s.Departure_Time) = DATE(?)'
        params.append(trip_date)

    query += ' ORDER BY s.Departure_Time ASC'
    trips = conn.execute(query, params).fetchall()
    conn.close()
    
    return render_template(
        'search_results.html',
        trips=trips,
        origin=origin,
        destination=destination,
        trip_date=trip_date,
        transport_mode=transport_mode,
        map_url=build_google_maps_url(origin, destination)
    )

# --- 4. BOOKING ROUTE ---
@app.route('/book/<int:schedule_id>')
def book(schedule_id):
    # Developer Bypass for VS Code Preview
    if 'user_id' not in session:
        session['user_id'] = 1
        session['name'] = "RJ (Preview Mode)"

    user_id = session['user_id']
    conn = get_db_connection()

    trip_query = '''
        SELECT s.Schedule_ID, s.Departure_Time, s.Arrival_Time,
               r.Base_Fare, r.Origin, r.Destination,
               v.Type, v.Plate_Number
        FROM Schedule s
        JOIN Route r ON s.Route_ID = r.Route_ID
        LEFT JOIN Vehicle v ON s.Vehicle_ID = v.Vehicle_ID
        WHERE s.Schedule_ID = ?
          AND v.Type IN ('Bus', 'Taxi', 'Motorcycle')
    '''
    fare_result = conn.execute(trip_query, (schedule_id,)).fetchone()

    if fare_result:
        total_price = fare_result['Base_Fare']
        
        # Save the booking
        cursor = conn.execute(
            'INSERT INTO Booking (User_ID, Schedule_ID, Total_Price, Status) VALUES (?, ?, ?, ?)',
            (user_id, schedule_id, total_price, 'Confirmed')
        )
        conn.commit()
        booking_id = cursor.lastrowid
        conn.close()
        
        return render_template(
            'booking_success.html',
            price=total_price,
            booking_id=booking_id,
            trip=fare_result
        )
    
    conn.close()
    return "Error: Schedule not found."

# --- 5. MY TICKETS ROUTE ---
@app.route('/my_tickets')
def my_tickets():
    # Developer Bypass for VS Code Preview
    if 'user_id' not in session:
        session['user_id'] = 1
        session['name'] = "RJ (Preview Mode)"
        
    user_id = session['user_id']
    conn = get_db_connection()
    
    # Fetch all bookings for this user
    query = '''
        SELECT b.Booking_ID, b.Booking_Date, b.Status, b.Total_Price,
               s.Departure_Time, s.Arrival_Time,
               r.Origin, r.Destination,
               v.Plate_Number, v.Type
        FROM Booking b
        JOIN Schedule s ON b.Schedule_ID = s.Schedule_ID
        JOIN Route r ON s.Route_ID = r.Route_ID
        JOIN Vehicle v ON s.Vehicle_ID = v.Vehicle_ID
        WHERE b.User_ID = ?
        ORDER BY b.Booking_ID DESC
    '''
    tickets = conn.execute(query, (user_id,)).fetchall()
    conn.close()
    
    return render_template('my_tickets.html', tickets=tickets)


@app.route('/support')
def support():
    display_name = session.get('name') or session.get('user') or "Passenger"
    return render_template('support.html', name=display_name)

# --- START SERVER ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
