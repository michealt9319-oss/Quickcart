import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createPresignedUpload } from "../lib/s3";

export const uploadsRouter = Router();

const presignSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

// Returns a URL the ADMIN'S BROWSER/APP uploads directly to — this API
// never receives the image bytes. See lib/s3.ts for why.
uploadsRouter.post(
  "/presign",
  requireAuth,
  requireRole("owner", "manager"),
  validateBody(presignSchema),
  asyncHandler(async (req, res) => {
    const { contentType } = req.body as z.infer<typeof presignSchema>;
    const { uploadUrl, publicUrl } = await createPresignedUpload({
      organizationId: req.admin!.organizationId,
      contentType,
    });
    res.json({ uploadUrl, publicUrl });
  })
);
