# BLATHEIL eCommerce Backend API

Production-ready REST API built with Node.js, Express, MongoDB Atlas, and Cloudinary.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file in backend folder:

```env
PORT=5001
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0
JWT_SECRET=your_secret_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
NODE_ENV=development
SHIPROCKET_EMAIL=your_shiprocket_login_email
SHIPROCKET_PASSWORD=your_shiprocket_login_password

# Optional hardening/config
SHIPROCKET_WEBHOOK_SECRET=your_webhook_secret_token
SHIPROCKET_PICKUP_LOCATION=Primary
SHIPROCKET_DEFAULT_CITY=Mumbai
SHIPROCKET_DEFAULT_STATE=Maharashtra
SHIPROCKET_DEFAULT_PINCODE=400001

# Razorpay (test/live switch through keys)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_SECRET=your_razorpay_secret
```

### 3. Start Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5001`

### 4. Health Check

```bash
curl http://localhost:5001/api/health
```

## Default Admin Account

- Email: `blatheil134@gmail.com`
- Password: `password123`
- Status: `mustChangePassword = true`

⚠️ **Change password immediately upon first login!**

## API Routes

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/change-password` - Change password (protected)

### Users
- `GET /api/users/profile` - Get user profile (protected)

### Products
- `GET /api/products` - List all products (with pagination, search, filters)
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `DELETE /api/products/:id` - Delete product (admin only)

### Cart
- `GET /api/cart` - Get user's cart (protected)
- `POST /api/cart/add` - Add to cart (protected)
- `PUT /api/cart/update` - Update item quantity (protected)
- `POST /api/cart/remove` - Remove from cart (protected)
- `POST /api/cart/clear` - Clear cart (protected)

### Orders
- `POST /api/orders` - Create order (protected)
- `GET /api/orders/my` - Get user's orders (protected)
- `GET /api/orders` - Get all orders (admin only)
- `PUT /api/orders/:id/status` - Update order status (admin only)

### Shiprocket
- `POST /api/shiprocket/create-order` - Create or retry shipment for an order (admin only)
- `POST /api/shiprocket/webhook` - Receive shipping status updates from Shiprocket
- `GET /api/shiprocket/track/:awb` - Fetch latest tracking details for AWB

### Payment
- `POST /api/payment/create-order` - Create Razorpay payment order (protected)
- `POST /api/payment/verify` - Verify Razorpay signature and create DB order (protected)

### Upload
- `POST /api/upload` - Upload image to Cloudinary (admin only)

## Features

✅ Real JWT authentication with 7-day expiration
✅ Role-based access control (admin, user, staff)
✅ MongoDB Atlas database storage
✅ Cloudinary image hosting
✅ Drag-drop file upload with Multer
✅ Secure password hashing with bcrypt
✅ Real-time cart & order management
✅ WhatsApp order integration
✅ Email-ready order notifications
✅ Request validation & sanitization
✅ Rate limiting (200 requests per 15 min)
✅ CORS enabled for frontend
✅ Morgan logging

## Request Headers

All protected endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

## Response Format

Success:
```json
{
  "success": true,
  "data": {...}
}
```

Error:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Database Models

### User
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: "admin" | "user" | "staff",
  mustChangePassword: Boolean
}
```

### Product
```javascript
{
  name: String,
  price: Number,
  category: String,
  description: String,
  sizes: ["S", "M", "L", "XL"],
  stock: Number,
  images: [String],
  isFeatured: Boolean,
  isSoldOut: Boolean
}
```

### Order
```javascript
{
  userId: ObjectId,
  items: [
    {
      productId: ObjectId,
      quantity: Number,
      size: String
    }
  ],
  totalPrice: Number,
  shippingAddress: String,
  phone: String,
  status: "pending" | "confirmed" | "shipped" | "delivered"
}
```

### Cart
```javascript
{
  userId: ObjectId,
  items: [
    {
      productId: ObjectId,
      quantity: Number,
      size: String
    }
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | Yes | Server port (default: 5001) |
| MONGO_URI | Yes | MongoDB Atlas connection string |
| JWT_SECRET | Yes | Secret key for JWT signing |
| CLOUDINARY_CLOUD_NAME | Yes | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Yes | Cloudinary API key |
| CLOUDINARY_API_SECRET | Yes | Cloudinary API secret |
| NODE_ENV | No | Environment (development/production) |
| SHIPROCKET_EMAIL | Yes (for shipping) | Shiprocket account login email |
| SHIPROCKET_PASSWORD | Yes (for shipping) | Shiprocket account login password |
| SHIPROCKET_WEBHOOK_SECRET | No | Optional token to validate incoming webhook requests |
| RAZORPAY_KEY_ID | Yes (for Razorpay) | Razorpay key id (test or live) |
| RAZORPAY_SECRET | Yes (for Razorpay) | Razorpay secret used for payment signature verification |

## Security Notes

- All passwords hashed with bcrypt (10 rounds)
- JWT expires in 7 days
- Rate limiting: 200 requests per 15 minutes
- Input validation on all endpoints
- CORS enabled (configure in production)
- Remove test credentials in production

## Troubleshooting

**Connection refused on startup?**
- Check MongoDB Atlas IP whitelist
- Verify MONGO_URI is correct
- Ensure network connectivity

**Cloudinary upload fails?**
- Verify API credentials
- Check file size (max 5MB)
- Ensure image file type

**JWT errors?**
- Check token format: `Bearer <token>`
- Verify JWT_SECRET is consistent
- Ensure token hasn't expired

## Support

For issues or questions, create an issue in the repository.
