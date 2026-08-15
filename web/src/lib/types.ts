export type QuotationStatus =
  | "submitted"
  | "processing"
  | "pending"
  | "converted"
  | "sale_cancelled";

export type Currency = "INR" | "USD";
export type PriceTier = "base" | "dealer" | "selling";
export type ImageLayout = "center" | "right";
export type AddonType = "checkbox" | "radio";

export type StandardAccessory = {
  name: string;
  qty: number;
};

export type Category = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  model_no: string | null;
  category_id: string | null;
  description: string | null;
  features: string[];
  specifications: Record<string, string>;
  standard_accessories: StandardAccessory[];
  base_price: number;
  dealer_price: number;
  selling_price: number;
  image_url: string | null;
  image_layout: ImageLayout;
  material_of_construction: string | null;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
};

export type ProductAddon = {
  id: string;
  product_id: string;
  name: string;
  type: AddonType;
  options: string[] | null;
  default_price: number | null;
  sort_order: number;
};

export type Addon = {
  id: string;
  name: string;
  type: AddonType;
  options: string[] | null;
  default_price: number | null;
  created_by: string | null;
  created_at: string;
};

export type Dealer = {
  id: string;
  dealer_reg_no: string;
  dealer_name: string;
  company_name: string | null;
  gst_no: string | null;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  created_by: string | null;
  created_at: string;
};

export type Quotation = {
  id: string;
  quotation_number: string;
  parent_quotation_id: string | null;
  version: number;
  status: QuotationStatus;
  status_custom: string | null;
  currency: Currency;
  fx_rate_used: number | null;
  client_name: string | null;
  client_company: string | null;
  client_address: string | null;
  is_dealer_sale: boolean;
  dealer_id: string | null;
  created_by: string;
  follow_up_date: string | null;
  reminder_sent: boolean;
  validity_date: string | null;
  terms_snapshot: string | null;
  prepared_by_name: string | null;
  prepared_by_phone: string | null;
  prepared_by_email: string | null;
  total_amount: number | null;
  pdf_storage_path: string | null;
  created_at: string;
  updated_at: string;
};

export type QuotationItem = {
  id: string;
  quotation_id: string;
  product_id: string | null;
  price_tier: PriceTier;
  unit_price: number;
  quantity: number;
  image_layout_override: ImageLayout | null;
  sort_order: number;
  product_name: string | null;
  model_no: string | null;
  description: string | null;
  features: string[] | null;
  specifications: Record<string, string> | null;
  image_url: string | null;
  standard_accessories: StandardAccessory[] | null;
  material_of_construction: string | null;
};

export type QuotationAddon = {
  id: string;
  quotation_id: string;
  addon_id: string | null;
  product_addon_id: string | null;
  quotation_item_id: string | null;
  selected_option: string | null;
  price: number | null;
  addon_name: string | null;
};

export type TermsClause = {
  id: string;
  body: string;
  sort_order: number;
  is_active: boolean;
};

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  submitted: "Submitted",
  processing: "Processing",
  pending: "Pending",
  converted: "Approved",
  sale_cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<QuotationStatus, string> = {
  submitted: "bg-[#53617A]/10 text-[#53617A] ring-[#53617A]/20",
  processing: "bg-[#E48B59]/15 text-[#9a4e28] ring-[#E48B59]/30",
  pending: "bg-[#D8DADF] text-[#111827] ring-[#D8DADF]",
  converted: "bg-[#ED7B46]/15 text-[#9a3f1c] ring-[#ED7B46]/30",
  sale_cancelled: "bg-[#111827]/8 text-[#111827] ring-[#111827]/15",
};

export const QUOTATION_STATUSES: QuotationStatus[] = [
  "submitted",
  "processing",
  "pending",
  "converted",
  "sale_cancelled",
];

export const COMPANY = {
  name: "RAISE LAB EQUIPMENT",
  addressLines: [
    "C-2, Industrial Park, Moula-Ali,",
    "Behind Post Office, Industrial Park Road,",
    "Hyderabad, Medchal Malkajgiri Dist. Telangana. PIN 500040. INDIA.",
  ],
  emails: "info@raiselabequip.com / sales@raiselabequip.com",
  phone: "+91 91777 70365",
  /** Letterhead border colors from letter_head_ 1.docx */
  borderOuter: "#0070C0",
  borderInner: "#E36C0A",
};

export const DEFAULT_VALIDITY_DAYS = 30;
