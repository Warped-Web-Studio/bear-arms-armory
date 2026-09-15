import { requireAdmin } from "@/lib/admin";
import { getBusiness } from "@/lib/data";
import { BusinessForm } from "@/components/admin/business-form";
import { imageUploadsConfigured } from "@/lib/image-storage";
export default async function BusinessPage() {
  await requireAdmin();
  const business = await getBusiness();
  return (
    <>
      <p className="eyebrow">The essentials</p>
      <h1>Business information</h1>
      <p className="admin-intro">
        Use verified details. These appear in the store information, contact
        section, and local business search data.
      </p>
      <BusinessForm
        business={business}
        uploadsConfigured={imageUploadsConfigured()}
      />
    </>
  );
}
