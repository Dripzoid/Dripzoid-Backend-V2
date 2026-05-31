import express from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/users/user.routes.js";
import sessionRoutes from "../modules/sessions/session.routes.js";
import orderRoutes from "../modules/orders/order.routes.js";
import userOrdersRoutes from "../modules/orders/userOrders.routes.js";
import adminOrdersRoutes from "../modules/orders/adminOrders.routes.js";
import adminProductsRoutes from "../modules/products/adminProducts.routes.js";
import productRoutes from "../modules/products/product.routes.js";
import slidesRoutes from "../modules/marketing/slides/slides.routes.js";
import salesRoutes from "../modules/marketing/sales/sales.routes.js";
import uploadRoutes from "../modules/uploads/upload.routes.js";
import votesRoutes from "../modules/votes/votes.routes.js";
import reviewsRoutes from "../modules/reviews/reviews.routes.js";
import qaRoutes from "../modules/qa/qa.routes.js";
import jobsRoutes from "../modules/careers/jobs/jobs.routes.js";
import applicationsRoutes from "../modules/careers/applications/applications.routes.js";
import certificatesRoutes from "../modules/careers/certificates/certificates.routes.js";
import cartRoutes from "../modules/cart/cart.routes.js";
import couponsRoutes from "../modules/coupons/coupons.routes.js";
import wishlistRoutes from "../modules/wishlist/wishlist.routes.js";
import webhookRoutes from "./webhook.routes.js";
import emailRoutes from "../modules/email/email.routes.js";
import otpRoutes from "../modules/otp/otp.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import addressRoutes from "../modules/address/address.routes.js";
import accountRoutes from "../modules/account/account.routes.js";
import backupRoutes from "../modules/admin/backup.routes.js";
import adminStatsRoutes from "../modules/admin/stats/stats.routes.js";
import shippingRoutes from "../integrations/shiprocket/shipping.routes.js";
import askdripRoutes from "../modules/askdrip/askdrip.routes.js";
import semanticRoutes from "../modules/semantic-search/semantic.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/sessions", sessionRoutes);
router.use("/orders", orderRoutes);
router.use("/user/orders", userOrdersRoutes);
router.use("/admin/orders", adminOrdersRoutes);
router.use(
  "/admin",
  backupRoutes
);
router.use(
  "/admin",
  adminStatsRoutes
);
router.use(
  "/admin/products",
  adminProductsRoutes
);
router.use("/", productRoutes);
router.use("/", slidesRoutes);
router.use("/", salesRoutes);
router.use("/", uploadRoutes);
router.use(
  "/votes",
  votesRoutes
);
router.use(
  "/reviews",
  reviewsRoutes
);
router.use(
  "/qa",
  qaRoutes
);
router.use(
  "/jobs",
  jobsRoutes
);
router.use(
  "/applications",
  applicationsRoutes
);
router.use(
  "/certificates",
  certificatesRoutes
);
router.use(
  "/cart",
  cartRoutes
);
router.use(
  "/coupons",
  couponsRoutes
);
router.use(
  "/wishlist",
  wishlistRoutes
);
router.use(
  "/webhooks",
  webhookRoutes
);
router.use(
  "/email",
  emailRoutes
);
router.use(
  "/",
  otpRoutes
);
router.use(
  "/payments",
  paymentRoutes
);
router.use(
  "/addresses",
  addressRoutes
);
router.use(
  "/account",
  accountRoutes
);
router.use(
  "/shipping",
  shippingRoutes
);
router.use(
  "/v1/askdrip",
  askdripRoutes
);
router.use(
  "/semantic",
  semanticRoutes
);

export default router;
