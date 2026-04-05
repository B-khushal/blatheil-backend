const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required for review']
  },
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required for review']
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    description: 'Order ID for verified purchase badge'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer between 1 and 5'
    }
  },
  title: {
    type: String,
    default: '',
    maxlength: [100, 'Review title cannot exceed 100 characters'],
    trim: true
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    minlength: [10, 'Review must be at least 10 characters'],
    maxlength: [2000, 'Review cannot exceed 2000 characters'],
    trim: true
  },
  image_url: {
    type: String,
    default: null,
    description: 'Cloudinary image URL for product photo proof'
  },
  is_verified_purchase: {
    type: Boolean,
    default: false,
    description: 'Auto-set to true if order_id exists'
  },
  helpful_count: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Number of users who marked review as helpful'
  },
  is_featured: {
    type: Boolean,
    default: false,
    description: 'Admin-marked featured review'
  },
  is_pinned: {
    type: Boolean,
    default: false,
    description: 'Admin-pinned reviews show at top'
  },
  is_visible: {
    type: Boolean,
    default: true,
    description: 'Hidden reviews not shown in public display'
  },
  moderation_status: {
    type: String,
    enum: ['pending', 'approved', 'flagged', 'rejected'],
    default: 'approved',
    description: 'Auto-moderation flag for spam/profanity'
  },
  is_reported: {
    type: Boolean,
    default: false,
    description: 'User-reported inappropriate review'
  },
  report_reason: {
    type: String,
    enum: ['spam', 'offensive', 'fake', 'irrelevant', 'other'],
    default: null
  },
  moderation_notes: {
    type: String,
    default: null,
    description: 'Admin notes on why review was flagged/rejected'
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
    description: 'Review creation timestamp'
  },
  updated_at: {
    type: Date,
    default: Date.now,
    description: 'Last update timestamp'
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes for performance
reviewSchema.index({ product_id: 1, created_at: -1 });
reviewSchema.index({ user_id: 1 });
reviewSchema.index({ product_id: 1, is_visible: 1 });
reviewSchema.index({ moderation_status: 1 });
reviewSchema.index({ is_reported: 1 });

// Virtual for average rating calculation
reviewSchema.virtual('helpful_percentage').get(function() {
  return this.helpful_count;
});

// Pre-save middleware to validate order and set verified purchase
reviewSchema.pre('save', async function(next) {
  if (!this.isModified()) return next();
  
  // Set verified purchase flag if order_id exists
  if (this.order_id) {
    this.is_verified_purchase = true;
  }
  
  next();
});

// Post-save hook to update product rating
reviewSchema.post('save', async function(next) {
  try {
    const Product = mongoose.model('Product');
    const Review = mongoose.model('Review');
    
    // Calculate average rating and count
    const stats = await Review.aggregate([
      { $match: { product_id: this.product_id, is_visible: true, is_reported: false } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);
    
    if (stats.length > 0) {
      const distribution = {
        5: 0, 4: 0, 3: 0, 2: 0, 1: 0
      };
      stats[0].ratingDistribution.forEach(rating => {
        distribution[rating]++;
      });
      
      await Product.findByIdAndUpdate(
        this.product_id,
        {
          averageRating: parseFloat(stats[0].averageRating.toFixed(1)),
          totalReviews: stats[0].totalReviews,
          ratingDistribution: distribution
        }
      );
    }
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
});

// Post-delete hook to update product rating
reviewSchema.post('deleteOne', { document: true }, async function() {
  try {
    const Product = mongoose.model('Product');
    const Review = mongoose.model('Review');
    
    const stats = await Review.aggregate([
      { $match: { product_id: this.product_id, is_visible: true, is_reported: false } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);
    
    if (stats.length > 0) {
      const distribution = {
        5: 0, 4: 0, 3: 0, 2: 0, 1: 0
      };
      stats[0].ratingDistribution.forEach(rating => {
        distribution[rating]++;
      });
      
      await Product.findByIdAndUpdate(
        this.product_id,
        {
          averageRating: parseFloat(stats[0].averageRating.toFixed(1)),
          totalReviews: stats[0].totalReviews,
          ratingDistribution: distribution
        }
      );
    } else {
      // No reviews left, reset rating
      await Product.findByIdAndUpdate(
        this.product_id,
        {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        }
      );
    }
  } catch (error) {
    console.error('Error updating product rating after deletion:', error);
  }
});

module.exports = mongoose.model('Review', reviewSchema);
