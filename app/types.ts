export interface BoxItem {
  id: string;
  name: string;
  description: string;
}

export interface Box {
  id: string;
  description: string;
  items: BoxItem[];
}
