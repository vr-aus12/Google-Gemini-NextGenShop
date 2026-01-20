
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import json
import uuid
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE = 'marketplace.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    cardNumber: Optional[str] = None
    cardExpiry: Optional[str] = None
    cardCvv: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    order_id: str
    status: str

class CheckoutRequest(BaseModel):
    user_id: str
    address: str
    payment_method: str

class ReviewCreate(BaseModel):
    user_id: str
    user_name: str
    rating: int
    comment: str
    date: str

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            category TEXT,
            image TEXT,
            rating REAL,
            specs TEXT,
            seller_id TEXT,
            seller_name TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
            role TEXT,
            address TEXT,
            cardNumber TEXT,
            cardExpiry TEXT,
            cardCvv TEXT,
            isLoggedIn INTEGER
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cart (
            user_id TEXT,
            product_id TEXT,
            quantity INTEGER,
            PRIMARY KEY (user_id, product_id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            date TEXT,
            total REAL,
            status TEXT,
            shipping_address TEXT,
            payment_method TEXT,
            items TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            product_id TEXT,
            user_id TEXT,
            user_name TEXT,
            rating INTEGER,
            comment TEXT,
            date TEXT
        )
    ''')
    
    cursor.execute('SELECT COUNT(*) FROM products')
    if cursor.fetchone()[0] == 0:
        dummy_data = [
            ('1', 'Mechanical Gaming Keyboard', 'Ultra-responsive RGB mechanical keyboard.', 129.99, 'Gaming', 'https://picsum.photos/seed/keyboard/400/400', 4.8, json.dumps(['RGB Lighting', 'Tactile Brown Switches']), 'seller_1', 'Razer Master'),
            ('2', 'Logitech G Pro Wireless', 'Esports pro mouse.', 99.99, 'Gaming', 'https://picsum.photos/seed/mouse/400/400', 4.9, json.dumps(['Lightspeed Wireless', 'HERO 25K Sensor']), 'seller_2', 'LogiStore'),
            ('3', 'Sony WH-1000XM5', 'Noise canceling headphones.', 348.00, 'Audio', 'https://picsum.photos/seed/headphones/400/400', 4.7, json.dumps(['30h Battery', 'LDAC']), 'seller_3', 'Sony Official'),
            ('4', 'Ergonomic Office Chair', 'Breathable mesh chair.', 499.00, 'Workstation', 'https://picsum.photos/seed/chair/400/400', 4.6, json.dumps(['Adjustable Lumbar', '4D Armrests']), 'seller_1', 'Razer Master')
        ]
        cursor.executemany('INSERT INTO products (id, name, description, price, category, image, rating, specs, seller_id, seller_name) VALUES (?,?,?,?,?,?,?,?,?,?)', dummy_data)
        
    conn.commit()
    conn.close()

init_db()

@app.get("/products")
async def get_products(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM products ORDER BY id DESC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.get("/reviews/{product_id}")
async def get_reviews(product_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reviews WHERE product_id = ? ORDER BY date DESC", (product_id,))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/reviews/{product_id}")
async def create_review(product_id: str, review: ReviewCreate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    review_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO reviews (id, product_id, user_id, user_name, rating, comment, date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (review_id, product_id, review.user_id, review.user_name, review.rating, review.comment, review.date))
    db.commit()
    return {"status": "success"}

@app.get("/orders/{user_id}")
async def get_user_orders(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY date DESC", (user_id,))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.get("/seller/orders/{seller_id}")
async def get_seller_orders(seller_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM orders")
    rows = cursor.fetchall()
    result = []
    for row in rows:
        order = dict(row)
        items = json.loads(order['items'])
        seller_items = [i for i in items if i['seller_id'] == seller_id]
        if seller_items:
            order['items'] = seller_items
            result.append(order)
    return result

@app.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: OrderStatusUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (payload.status, order_id))
    db.commit()
    return {"status": "success"}

@app.post("/checkout")
async def process_checkout(req: CheckoutRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute('''
        SELECT p.*, c.quantity 
        FROM cart c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.user_id = ?
    ''', (req.user_id,))
    rows = cursor.fetchall()
    if not rows:
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_items = []
    total = 0
    for row in rows:
        p = dict(row)
        item_total = p['price'] * p['quantity']
        total += item_total
        order_items.append({
            "product_id": p['id'],
            "product_name": p['name'],
            "price": p['price'],
            "quantity": p['quantity'],
            "seller_id": p['seller_id'],
            "status": "Pending"
        })

    order_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO orders (id, user_id, date, total, status, shipping_address, payment_method, items) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, req.user_id, datetime.now().isoformat(), total, 'Pending', req.address, req.payment_method, json.dumps(order_items)))
    
    cursor.execute('DELETE FROM cart WHERE user_id = ?', (req.user_id,))
    db.commit()
    return {"status": "success", "order_id": order_id}

@app.get("/user/{user_id}")
async def get_profile(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if row:
        return dict(row)
    return {"id": user_id, "name": "New User", "role": "buyer", "address": "", "cardNumber": ""}

@app.post("/user/{user_id}")
async def update_profile(user_id: str, profile: ProfileUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
    if cursor.fetchone():
        cursor.execute('''
            UPDATE users SET name = COALESCE(?, name), address = COALESCE(?, address), cardNumber = COALESCE(?, cardNumber), cardExpiry = COALESCE(?, cardExpiry), cardCvv = COALESCE(?, cardCvv)
            WHERE id = ?
        ''', (profile.name, profile.address, profile.cardNumber, profile.cardExpiry, profile.cardCvv, user_id))
    else:
        cursor.execute('''
            INSERT INTO users (id, name, address, cardNumber, cardExpiry, cardCvv, role, isLoggedIn)
            VALUES (?, ?, ?, ?, ?, ?, 'buyer', 1)
        ''', (user_id, profile.name, profile.address, profile.cardNumber, profile.cardExpiry, profile.cardCvv))
    db.commit()
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
