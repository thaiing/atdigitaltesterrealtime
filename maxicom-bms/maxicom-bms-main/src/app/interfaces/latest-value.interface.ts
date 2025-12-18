export interface LatestValueResponse<T> {
  code: string;
  success: boolean;
  description: string | null;
  data: T;
}

