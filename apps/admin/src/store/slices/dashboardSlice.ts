import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "@/lib/api";

export const fetchDailySales = createAsyncThunk(
  "dashboard/dailySales",
  async (branchId?: string) => {
    const { data } = await api.get("/reports/daily-sales", {
      params: branchId ? { branchId } : undefined,
    });
    return data.data;
  }
);

export const fetchTopItems = createAsyncThunk(
  "dashboard/topItems",
  async (branchId?: string) => {
    const { data } = await api.get("/reports/top-items", {
      params: branchId ? { branchId } : undefined,
    });
    return data.data;
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    dailySales: null as Record<string, unknown> | null,
    topItems: [] as unknown[],
    loading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailySales.fulfilled, (state, action) => {
        state.dailySales = action.payload;
        state.loading = false;
      })
      .addCase(fetchTopItems.fulfilled, (state, action) => {
        state.topItems = action.payload;
      });
  },
});

export default dashboardSlice.reducer;
