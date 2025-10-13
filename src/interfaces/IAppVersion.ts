export interface IAppVersion {
  id: number;
  platform: 'android' | 'ios' | 'web';
  version: string;
  force_update: number;
  release_notes: string;
  created_at: string;
  updated_at: string;
}
