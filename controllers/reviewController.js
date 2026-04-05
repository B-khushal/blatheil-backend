const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

// Profanity list for basic spam detection
const profanityList = [
  'badword1', 'badword2', 'badword3' // Add actual profanity words as needed
];

// Check for profanity and spam indicators
const checkModerationFlags = (text) => {
  let flags = [];
  
  // Simple profanity check
  const lowerText = text.toLowerCase();
  profanityList.forEach(word => {
    if (lowerText.includes(word)) {
      flags.push('profanity');
    }
  });
  
  // Check for spam patterns
  if (/http|url|click|link|@|\.com|\.co/.test(text)) {
    flags.push('spam_link');
  }
  
  // Check for excessive caps
  if ((text.match(/[A-Z]/g) || []).length > text.length * 0.3) {
    flags.push('excessive_caps');
  }
  
  return flags;
};

// POST - Add new review
exports.addReview = async (req, res) => {
  try {
    const { productId, orderId, rating, title, comment, imageUrl } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!productId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, rating, and comment are required'
      });
    }

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user_id: userId,
      product_id: productId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. You can edit your existing review instead.'
      });
    }

    // Validate verified purchase if orderId is provided
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        userId: userId
      });

      if (!order) {
        return res.status(400).json({
          success: false,
          message: 'You can only review products from your own orders'
        });
      }

      // Check if product is in the order
      const productInOrder = order.items.some(
        item => item.productId.toString() === productId
      );

      if (!productInOrder) {
        return res.status(400).json({
          success: false,
          message: 'This product is not in your order'
        });
      }

      isVerifiedPurchase = true;
    }

    // Check moderation flags
    const moderationFlags = checkModerationFlags(comment);
    const moderationStatus = moderationFlags.length > 0 ? 'flagged' : 'approved';

    // Create review
    const review = new Review({
      user_id: userId,
      product_id: productId,
      order_id: orderId || null,
      rating,
      title: title || '',
      comment,
      image_url: imageUrl || null,
      is_verified_purchase: isVerifiedPurchase,
      moderation_status: moderationStatus
    });

    await review.save();

    // Populate user details for response
    await review.populate('user_id', 'name email');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        image_url: review.image_url,
        is_verified_purchase: review.is_verified_purchase,
        customer_name: review.user_id.name,
        created_at: review.created_at,
        moderation_status: review.moderation_status
      },
      note: moderationStatus === 'flagged' 
        ? 'Your review is under moderation and will be visible shortly'
        : 'Your review is now visible'
    });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit review',
      error: error.message
    });
  }
};

// GET - Fetch reviews for a product with filters and sorting
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    let { page = 1, limit = 10, sortBy = 'latest' } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID'
      });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Build sort object
    let sortObj = { created_at: -1 };
    
    switch (sortBy) {
      case 'highest':
        sortObj = { rating: -1, created_at: -1 };
        break;
      case 'lowest':
        sortObj = { rating: 1, created_at: -1 };
        break;
      case 'helpful':
        sortObj = { helpful_count: -1, created_at: -1 };
        break;
      case 'latest':
      default:
        sortObj = { is_pinned: -1, created_at: -1 };
    }

    // Build query
    const query = {
      product_id: productId,
      is_visible: true,  // Only show visible reviews
      is_reported: { $ne: true }  // Exclude reported reviews
    };

    // Only admin can see flagged/rejected reviews
    if (!req.user || req.user.role !== 'admin') {
      query.moderation_status = { $in: ['approved', 'pending'] };
    }

    // Get total count
    const totalReviews = await Review.countDocuments(query);

    // Compute reliable rating stats from matching reviews (avoids stale/missing product aggregates)
    const stats = await Review.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
          average: { $avg: '$rating' }
        }
      }
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    stats.forEach((s) => {
      const rating = Number(s._id);
      if (ratingDistribution[rating] !== undefined) {
        ratingDistribution[rating] = Number(s.count) || 0;
      }
    });

    const totalFromDistribution = Object.values(ratingDistribution).reduce((sum, n) => sum + Number(n || 0), 0);
    const averageRating = totalFromDistribution > 0
      ? Number(
          (
            (ratingDistribution[5] * 5 +
              ratingDistribution[4] * 4 +
              ratingDistribution[3] * 3 +
              ratingDistribution[2] * 2 +
              ratingDistribution[1] * 1) /
            totalFromDistribution
          ).toFixed(1)
        )
      : 0;

    // Fetch reviews with pagination
    const reviews = await Review.find(query)
      .populate('user_id', 'name email')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich response with formatted data
    const enrichedReviews = reviews.map(review => ({
      _id: review._id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      image_url: review.image_url,
      customer_name: review.user_id?.name || 'Anonymous',
      is_verified_purchase: review.is_verified_purchase,
      helpful_count: review.helpful_count,
      is_featured: review.is_featured,
      is_pinned: review.is_pinned,
      created_at: review.created_at
    }));

    res.status(200).json({
      success: true,
      reviews: enrichedReviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        itemsPerPage: limit
      },
      productRating: {
        average: averageRating,
        totalReviews: totalFromDistribution,
        distribution: ratingDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// GET - Fetch single review by ID
exports.getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId)
      .populate('user_id', 'name email')
      .populate('product_id', 'name')
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      review
    });
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review',
      error: error.message
    });
  }
};

// PUT - Update review (only by review author)
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment, imageUrl } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check authorization (only author can edit)
    if (review.user_id.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own reviews'
      });
    }

    // Update allowed fields
    if (rating) review.rating = rating;
    if (title) review.title = title;
    if (comment) {
      review.comment = comment;
      // Re-check moderation flags for updated comment
      const moderationFlags = checkModerationFlags(comment);
      review.moderation_status = moderationFlags.length > 0 ? 'flagged' : 'approved';
    }
    if (imageUrl) review.image_url = imageUrl;

    review.updated_at = new Date();
    await review.save();

    // Repopulate for response
    await review.populate('user_id', 'name email');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        image_url: review.image_url,
        is_verified_purchase: review.is_verified_purchase,
        customer_name: review.user_id.name,
        created_at: review.created_at,
        updated_at: review.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review',
      error: error.message
    });
  }
};

// DELETE - Delete review (only by author or admin)
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check authorization
    const isAuthor = review.user_id.toString() === userId.toString();
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews. Admins can delete any review.'
      });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
};

// POST - Mark review as helpful
exports.markLikeReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $inc: { helpful_count: 1 } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Review marked as helpful',
      helpful_count: review.helpful_count
    });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark review as helpful',
      error: error.message
    });
  }
};

// POST - Report review
exports.reportReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reportReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    if (!['spam', 'offensive', 'fake', 'irrelevant', 'other'].includes(reportReason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report reason'
      });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      {
        is_reported: true,
        report_reason: reportReason
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Review reported successfully. Our team will review it shortly.'
    });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report review',
      error: error.message
    });
  }
};

// ============ ADMIN ENDPOINTS ============

// GET - All reviews for admin with filters
exports.adminGetAllReviews = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 20,
      productId,
      userId,
      rating,
      moderation,
      isReported = false,
      sortBy = 'latest'
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // Build query
    const query = {};
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query.product_id = productId;
    }
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user_id = userId;
    }
    if (rating) {
      query.rating = parseInt(rating);
    }
    if (moderation) {
      query.moderation_status = moderation;
    }
    if (isReported === 'true') {
      query.is_reported = true;
    }

    // Build sort
    let sortObj = { created_at: -1 };
    if (sortBy === 'helpful') {
      sortObj = { helpful_count: -1 };
    } else if (sortBy === 'reported') {
      sortObj = { is_reported: -1, created_at: -1 };
    }

    // Get total count
    const totalReviews = await Review.countDocuments(query);

    // Fetch reviews
    const reviews = await Review.find(query)
      .populate('user_id', 'name email')
      .populate('product_id', 'name')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit),
        totalReviews,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// PUT - Admin update review moderation
exports.adminUpdateModeration = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { moderationStatus, isFeatured, isPinned, isVisible, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const updateData = {};
    if (moderationStatus) updateData.moderation_status = moderationStatus;
    if (typeof isFeatured === 'boolean') updateData.is_featured = isFeatured;
    if (typeof isPinned === 'boolean') updateData.is_pinned = isPinned;
    if (typeof isVisible === 'boolean') updateData.is_visible = isVisible;
    if (notes) updateData.moderation_notes = notes;
    updateData.updated_at = new Date();

    const review = await Review.findByIdAndUpdate(
      reviewId,
      updateData,
      { new: true }
    ).populate('user_id', 'name email');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    console.error('Error updating review moderation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review',
      error: error.message
    });
  }
};

// DELETE - Admin force delete any review
exports.adminDeleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Log deletion reason
    console.log(`Admin ${req.user._id} deleted review ${reviewId}. Reason: ${reason || 'No reason provided'}`);

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Review permanently removed'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
};

// GET - Admin search reviews
exports.adminSearchReviews = async (req, res) => {
  try {
    const { searchTerm, productName, customerName, page = 1, limit = 20 } = req.query;

    const query = {};

    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { comment: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    let reviews = await Review.find(query)
      .populate('user_id', 'name email')
      .populate('product_id', 'name')
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Additional filtering after population
    if (productName) {
      reviews = reviews.filter(r =>
        r.product_id.name.toLowerCase().includes(productName.toLowerCase())
      );
    }
    if (customerName) {
      reviews = reviews.filter(r =>
        r.user_id.name.toLowerCase().includes(customerName.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    console.error('Error searching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search reviews',
      error: error.message
    });
  }
};

module.exports = exports;
