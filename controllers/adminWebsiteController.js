const asyncHandler = require("express-async-handler");
const WebsiteContent = require("../models/WebsiteContent");

// @desc    Get website content (public or admin)
// @route   GET /api/admin/website-content
// @access  Public
const getWebsiteContent = asyncHandler(async (req, res) => {
  let content = await WebsiteContent.findOne();

  // Seed default if it doesn't exist yet
  if (!content) {
    // Generate default lookbook collections
    const collections = [
      { id: "1", title: "Dominion Oversized Hoodie", image: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", redirectLink: "/shop", displayOrder: 1 },
      { id: "2", title: "Sovereign Bomber Jacket", image: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", redirectLink: "/shop", displayOrder: 2 },
      { id: "3", title: "Legacy Graphic Tee", image: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", redirectLink: "/shop", displayOrder: 3 },
      { id: "4", title: "Tactical Cargo Pants", image: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", redirectLink: "/shop", displayOrder: 4 },
      { id: "5", title: "Crown Snapback", image: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", redirectLink: "/shop", displayOrder: 5 }
    ];

    let defaultCountdown = new Date();
    defaultCountdown.setDate(defaultCountdown.getDate() + 3);

    content = await WebsiteContent.create({
      collectionsSection: collections,
      nextDropSection: {
        title: "Next Drop Incoming",
        description: "Limited pieces. Once they're gone, they're gone. Set your alarms.",
        image: "",
        countdownDate: defaultCountdown,
        isVisible: true
      }
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
