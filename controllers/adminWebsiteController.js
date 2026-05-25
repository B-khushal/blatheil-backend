const asyncHandler = require("express-async-handler");
const WebsiteContent = require("../models/WebsiteContent");

// @desc    Get website content (public or admin)
// @route   GET /api/admin/website-content
// @access  Public
const getWebsiteContent = asyncHandler(async (req, res) => {
  let content = await WebsiteContent.findOne();

  // If no website content exists, create an empty/clean default record
  if (!content) {
    content = await WebsiteContent.create({
      collectionsSection: [],
      nextDropSection: {
        title: "",
        description: "",
        image: "",
        countdownDate: null,
        isVisible: false,
      },
    });
  }

  res.status(200).json(content);
});

// @desc    Update website content
// @route   PUT /api/admin/website-content
// @access  Private/Admin
const updateWebsiteContent = asyncHandler(async (req, res) => {
  let content = await WebsiteContent.findOne();

  if (!content) {
    content = new WebsiteContent(req.body);
  } else {
    // Update fields conditionally
    if (req.body.heroSection) content.heroSection = req.body.heroSection;
    if (req.body.collectionsSection) content.collectionsSection = req.body.collectionsSection;
    if (req.body.nextDropSection) content.nextDropSection = req.body.nextDropSection;
    if (req.body.announcementBar) content.announcementBar = req.body.announcementBar;
    if (req.body.footer) content.footer = req.body.footer;
    if (req.body.seo) content.seo = req.body.seo;
  }

  const updatedContent = await content.save();
  res.status(200).json(updatedContent);
});

module.exports = {
  getWebsiteContent,
  updateWebsiteContent,
};
