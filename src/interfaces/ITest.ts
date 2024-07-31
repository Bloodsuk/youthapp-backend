import { YesNo } from "@src/constants/enums";

export interface ITest {
  id: number ;
  test_name: string ;
  cate_id: string;
  product_model: string ;
  test_sku: string ;
  test_biomarker: string ;
  product_description: string;
  description: string ;
  procedure: string ;
  side_effects: string ;
  price: string ;
  discount_type: string;
  cost: string;
  customer_cost: string;
  is_featured: YesNo;
  product_unit: string ;
  weights: string ;
  brand_id: number ;
  sort_id: number ;
  status: string ;
  template_type: string;
  meta_title: string ;
  meta_keyword: string ;
  meta_description: string ;
  added_on: string ;
  last_updatedon: string ;
  added_by: number ;
  image_url: string ;
  image_banner: string ;
  banner_link: string ;
  prd_type: string ;
  is_reorder: YesNo;
  product_code: string;
  add_on_products: string;
  is_addon: YesNo;
  created_at: string ;
  practitioner_id: number
}
