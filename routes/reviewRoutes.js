const express = require('express');
const router = express.Router();
const {
  addReview,
  getProductReviews,
  getReviewById,
  updateReview,
  deleteReview,
  markLikeReview,
  reportReview,
  adminGetAllReviews,
  adminUpdateModeration,
  adminDeleteReview,
  adminSearchReviews
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/authMiddleware');

// Public routes - anyone can view reviews
router.get('/product/:productId', getProductReviews);
router.get('/:reviewId', getReviewById);

// User routes - require authentication
router.post('/', protect, addReview);
router.put('/:reviewId', protect, updateReview);
router.delete('/:reviewId', protect, deleteReview);
router.post('/:reviewId/like', protect, markLikeReview);
router.post('/:reviewId/report', protect, reportReview);

// Admin routes - require admin role
router.get('/admin/all', protect, adminOnly, adminGetAllReviews);
router.get('/admin/search', protect, adminOnly, adminSearchReviews);
router.put('/admin/:reviewId/moderation', protect, adminOnly, adminUpdateModeration);
router.delete('/admin/:reviewId', protect, adminOnly, adminDeleteReview);

module.exports = router;
