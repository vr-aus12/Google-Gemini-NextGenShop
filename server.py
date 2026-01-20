
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import json
import uuid
from datetime import datetime

app = FastAPI()

# Enable CORS for React frontend
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

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    specs: List[str]
    image: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    specs: Optional[List[str]] = None

class CartItemUpdate(BaseModel):
    product_id: str
    quantity: int
    user_id: str

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
            specs TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
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
            items TEXT
        )
    ''')
    
    cursor.execute('SELECT COUNT(*) FROM products')
    if cursor.fetchone()[0] == 0:
        dummy_data = [
            ('1', 'Mechanical Gaming Keyboard', 'Ultra-responsive RGB mechanical keyboard.', 129.99, 'Gaming', 'https://picsum.photos/seed/keyboard/400/400', 4.8, json.dumps(['RGB Lighting', 'Tactile Brown Switches'])),
            ('2', 'Logitech G Pro Wireless', 'Esports pro mouse.', 99.99, 'Gaming', 'https://picsum.photos/seed/mouse/400/400', 4.9, json.dumps(['Lightspeed Wireless', 'HERO 25K Sensor'])),
            ('3', 'Sony WH-1000XM5', 'Noise canceling headphones.', 348.00, 'Audio', 'https://picsum.photos/seed/headphones/400/400', 4.7, json.dumps(['30h Battery', 'LDAC'])),
            ('4', 'Ergonomic Office Chair', 'Breathable mesh chair.', 499.00, 'Workstation', 'https://picsum.photos/seed/chair/400/400', 4.6, json.dumps(['Adjustable Lumbar', '4D Armrests'])),
            ('5', 'Samsung 32" Odyssey G7', '1000R curved gaming monitor.', 699.99, 'Gaming', 'https://picsum.photos/seed/monitor/400/400', 4.5, json.dumps(['240Hz', '1ms response'])),
            ('6', 'MacBook Pro 14"', 'Power machine for creators.', 1999.00, 'Electronics', 'https://picsum.photos/seed/laptop/400/400', 4.9, json.dumps(['M3 Pro Chip', 'Liquid Retina XDR'])),
            ('7', 'Keychron Q1 Pro', 'Aluminum wireless keyboard.', 189.00, 'Workstation', 'https://picsum.photos/seed/keychron/400/400', 4.8, json.dumps(['Gasket Mount', 'Double-shot PBT'])),
            ('8', 'Blue Yeti Microphone', 'Pro recording and streaming.', 109.99, 'Audio', 'https://picsum.photos/seed/mic/400/400', 4.4, json.dumps(['Tri-capsule array', 'USB']))
        ]
        cursor.executemany('INSERT INTO products VALUES (?,?,?,?,?,?,?,?)', dummy_data)
        
        # Seed dummy orders
        dummy_orders = [
            (str(uuid.uuid4()), 'user_dev_1', datetime.now().isoformat(), 129.99, 'Delivered', json.dumps(['Mechanical Gaming Keyboard'])),
            (str(uuid.uuid4()), 'user_dev_1', datetime.now().isoformat(), 447.99, 'Shipped', json.dumps(['Sony WH-1000XM5', 'Logitech G Pro Wireless']))
        ]
        cursor.executemany('INSERT INTO orders VALUES (?,?,?,?,?,?)', dummy_orders)
        
    conn.commit()
    conn.close()

init_db()

@app.get("/products")
async def get_products(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM products ORDER BY id DESC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/products")
async def add_product(product: ProductCreate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    product_id = str(uuid.uuid4())
    img = product.image or f"https://picsum.photos/seed/{product_id}/400/400"
    cursor.execute(
        'INSERT INTO products (id, name, description, price, category, image, rating, specs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (product_id, product.name, product.description, product.price, product.category, img, 5.0, json.dumps(product.specs))
    )
    db.commit()
    return {"status": "success", "id": product_id}

@app.patch("/products/{product_id}")
async def update_product(product_id: str, product: ProductUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    update_data = {k: v for k, v in product.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    if 'specs' in update_data:
        update_data['specs'] = json.dumps(update_data['specs'])
        
    set_clause = ", ".join([f"{k} = ?" for k in update_data.keys()])
    values = list(update_data.values()) + [product_id]
    
    cursor.execute(f'UPDATE products SET {set_clause} WHERE id = ?', values)
    db.commit()
    return {"status": "success"}

@app.get("/seller/analytics")
async def get_analytics(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT SUM(total) as rev, COUNT(*) as sales FROM orders")
    row = cursor.fetchone()
    
    # Mock some monthly data
    monthly = [
        {"month": "Jan", "amount": 1200},
        {"month": "Feb", "amount": 1900},
        {"month": "Mar", "amount": row['rev'] or 0}
    ]
    
    return {
        "totalRevenue": row['rev'] or 0,
        "totalSales": row['sales'] or 0,
        "topProduct": "Mechanical Gaming Keyboard",
        "monthlyRevenue": monthly
    }

@app.get("/seller/orders")
async def get_orders(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY date DESC")
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.get("/cart/{user_id}")
async def get_cart(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute('''
        SELECT p.*, c.quantity 
        FROM cart c 
        JOIN products p ON c.product_id = p.id 
        WHERE c.user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    cart_items = []
    for row in rows:
        product_dict = dict(row)
        quantity = product_dict.pop('quantity')
        product_dict['specs'] = json.loads(product_dict['specs'])
        cart_items.append({"product": product_dict, "quantity": quantity})
    return cart_items

@app.post("/cart")
async def add_to_cart(item: CartItemUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute('INSERT OR REPLACE INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', 
                   (item.user_id, item.product_id, item.quantity))
    db.commit()
    return {"status": "success"}

@app.delete("/cart/{user_id}")
async def clear_cart(user_id: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    # Create an order before clearing
    cursor.execute("SELECT SUM(p.price * c.quantity) as total FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?", (user_id,))
    total = cursor.fetchone()['total'] or 0
    if total > 0:
        cursor.execute("SELECT p.name FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?", (user_id,))
        items = [r['name'] for r in cursor.fetchall()]
        order_id = str(uuid.uuid4())
        cursor.execute('INSERT INTO orders (id, user_id, date, total, status, items) VALUES (?, ?, ?, ?, ?, ?)',
                       (order_id, user_id, datetime.now().isoformat(), total, 'Pending', json.dumps(items)))
    
    cursor.execute('DELETE FROM cart WHERE user_id = ?', (user_id,))
    db.commit()
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
