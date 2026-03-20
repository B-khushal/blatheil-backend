const User = require("../models/User");
const { CONTACT_EMAIL } = require("../config/contact");

const bootstrapAdmin = async () => {
  const adminEmail = CONTACT_EMAIL;
  const existingAdmin = await User.findOne({ email: adminEmail });

  if (existingAdmin) {
    return;
  }

  await User.create({
    name: "BLATHEIL Admin",
    email: adminEmail,
    password: "password123",
    role: "admin",
    mustChangePassword: true,
  });

  console.log(`Default admin created: ${adminEmail}`);
};

module.exports = bootstrapAdmin;
