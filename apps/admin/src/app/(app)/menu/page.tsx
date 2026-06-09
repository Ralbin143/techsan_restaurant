"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MenuItemThumb } from "@/components/menu/MenuItemThumb";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Category {
  _id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: { _id: string; name: string } | string | null;
}

interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  ingredients?: string | null;
  image?: string | null;
  basePrice: number;
  isAvailable: boolean;
  isVeg: boolean;
  categoryId: Category | string;
}

type Tab = "categories" | "items";
type ItemView = "table" | "grouped";

const emptyItem = {
  name: "",
  description: "",
  ingredients: "",
  image: "",
  basePrice: 0,
  categoryId: "",
  isVeg: true,
  isAvailable: true,
};

const emptyCategory = {
  name: "",
  description: "",
  sortOrder: 0,
  parentId: "",
};

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [itemView, setItemView] = useState<ItemView>("grouped");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, itemsRes] = await Promise.all([
        api.get("/menu/categories"),
        api.get("/menu/items"),
      ]);
      setCategories(catRes.data.data);
      setItems(itemsRes.data.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to load menu. Please log in again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const itemCount = (categoryId: string) =>
    items.filter((i) => {
      const cid =
        typeof i.categoryId === "object" ? i.categoryId._id : (i.categoryId as string);
      return cid === categoryId;
    }).length;

  const filteredItems =
    categoryFilter === "all"
      ? items
      : items.filter((i) => {
          const cid =
            typeof i.categoryId === "object" ? i.categoryId._id : (i.categoryId as string);
          return cid === categoryFilter;
        });

  const openAddItem = () => {
    setEditingItemId(null);
    setItemForm({
      ...emptyItem,
      categoryId:
        categoryFilter !== "all" ? categoryFilter : categories[0]?._id || "",
    });
    setItemModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItemId(item._id);
    setItemForm({
      name: item.name,
      description: item.description || "",
      ingredients: item.ingredients || "",
      image: item.image || "",
      basePrice: item.basePrice,
      categoryId:
        typeof item.categoryId === "object" ? item.categoryId._id : (item.categoryId as string),
      isVeg: item.isVeg,
      isAvailable: item.isAvailable,
    });
    setItemModalOpen(true);
  };

  const openAddCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategory);
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategoryId(cat._id);
    setCategoryForm({
      name: cat.name,
      description: cat.description || "",
      sortOrder: cat.sortOrder ?? 0,
      parentId:
        typeof cat.parentId === "object" && cat.parentId
          ? cat.parentId._id
          : (cat.parentId as string) || "",
    });
    setCategoryModalOpen(true);
  };

  const parentCategories = categories.filter((c) => !c.parentId);
  const getParentName = (cat: Category) => {
    if (!cat.parentId) return "—";
    if (typeof cat.parentId === "object") return cat.parentId.name;
    return categories.find((c) => c._id === cat.parentId)?.name || "—";
  };

  const categoryLabel = (cat: Category) => {
    const parent = getParentName(cat);
    return parent !== "—" ? `${parent} › ${cat.name}` : cat.name;
  };

  const sortedCategories = [...categories].sort((a, b) => {
    const aParent = a.parentId ? 1 : 0;
    const bParent = b.parentId ? 1 : 0;
    if (aParent !== bParent) return aParent - bParent;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
  });

  const groupedMenu = sortedCategories
    .map((cat) => ({
      category: cat,
      items: items.filter((i) => {
        const cid =
          typeof i.categoryId === "object" ? i.categoryId._id : (i.categoryId as string);
        return cid === cat._id;
      }),
    }))
    .filter((g) => g.items.length > 0 || categoryFilter === g.category._id);

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItemId) {
        await api.patch(`/menu/items/${editingItemId}`, itemForm);
      } else {
        await api.post("/menu/items", itemForm);
      }
      setItemModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to save item"
      );
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...categoryForm,
        parentId: categoryForm.parentId || null,
      };
      if (editingCategoryId) {
        await api.patch(`/menu/categories/${editingCategoryId}`, payload);
      } else {
        await api.post("/menu/categories", payload);
      }
      setCategoryModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to save category"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this menu item?")) return;
    try {
      await api.delete(`/menu/items/${id}`);
      await loadData();
    } catch {
      alert("Failed to delete item");
    }
  };

  const deleteCategory = async (id: string) => {
    const count = itemCount(id);
    if (count > 0) {
      alert(`Cannot delete: ${count} menu item(s) use this category. Reassign or delete them first.`);
      return;
    }
    if (!confirm("Delete this category?")) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      if (categoryFilter === id) setCategoryFilter("all");
      await loadData();
    } catch {
      alert("Failed to delete category");
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.patch(`/menu/items/${item._id}`, { isAvailable: !item.isAvailable });
      await loadData();
    } catch {
      alert("Failed to update availability");
    }
  };

  const getCategoryName = (item: MenuItem) => {
    if (typeof item.categoryId === "object" && item.categoryId?.name) {
      return item.categoryId.name;
    }
    return categories.find((c) => c._id === item.categoryId)?.name || "—";
  };

  if (loading) {
    return <p className="text-slate-500">Loading menu...</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-medium">{error}</p>
        <button onClick={loadData} className="mt-3 text-sm underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <div className="flex gap-2">
          {tab === "categories" ? (
            <button
              onClick={openAddCategory}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <Plus size={16} />
              Add Category
            </button>
          ) : (
            <button
              onClick={openAddItem}
              disabled={categories.length === 0}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} />
              Add Item
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setTab("categories")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === "categories"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setTab("items")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === "items"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Menu Items ({items.length})
        </button>
      </div>

      {tab === "categories" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Parent</th>
                <th className="text-left p-4">Description</th>
                <th className="text-left p-4">Sort</th>
                <th className="text-left p-4">Items</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No categories yet. Click &quot;Add Category&quot; to create one.
                  </td>
                </tr>
              ) : (
                sortedCategories.map((cat) => (
                  <tr
                    key={cat._id}
                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="p-4 font-medium">
                      {cat.parentId ? (
                        <span className="text-slate-400 mr-1">↳</span>
                      ) : null}
                      {cat.name}
                    </td>
                    <td className="p-4 text-slate-500">{getParentName(cat)}</td>
                    <td className="p-4 text-slate-500 max-w-xs truncate">
                      {cat.description || "—"}
                    </td>
                    <td className="p-4">{cat.sortOrder ?? 0}</td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter(cat._id);
                          setTab("items");
                        }}
                        className="text-orange-600 hover:underline"
                      >
                        {itemCount(cat._id)} items
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="p-2 text-slate-500 hover:text-orange-600"
                        aria-label="Edit category"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat._id)}
                        className="p-2 text-slate-500 hover:text-red-600"
                        aria-label="Delete category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "items" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm text-slate-500">Filter:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="all">All categories</option>
              {sortedCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
              <button type="button" onClick={() => setItemView("grouped")} className={`px-3 py-1.5 ${itemView === "grouped" ? "bg-orange-600 text-white" : "bg-white dark:bg-slate-800"}`}>By category</button>
              <button type="button" onClick={() => setItemView("table")} className={`px-3 py-1.5 ${itemView === "table" ? "bg-orange-600 text-white" : "bg-white dark:bg-slate-800"}`}>Table</button>
            </div>
          </div>

          {categories.length === 0 && (
            <p className="mb-4 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              Create a category first, then add menu items.
            </p>
          )}

          {itemView === "grouped" ? (
            <div className="space-y-6">
              {(categoryFilter === "all"
                ? groupedMenu
                : groupedMenu.filter((g) => g.category._id === categoryFilter)
              ).length === 0 ? (
                <p className="text-center text-slate-400 py-12">No items to show.</p>
              ) : (
                (categoryFilter === "all"
                  ? groupedMenu
                  : groupedMenu.filter((g) => g.category._id === categoryFilter)
                ).map(({ category, items: catItems }) => (
                  <section
                    key={category._id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <h3 className="font-semibold">{categoryLabel(category)}</h3>
                      <span className="text-xs text-slate-500">{catItems.length} items</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {catItems.map((item) => (
                          <tr
                            key={item._id}
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="p-4 w-14">
                              <MenuItemThumb src={item.image} name={item.name} />
                            </td>
                            <td className="p-4 font-medium">{item.name}</td>
                            <td className="p-4">₹{item.basePrice}</td>
                            <td className="p-4">{item.isVeg ? "Veg" : "Non-Veg"}</td>
                            <td className="p-4">
                              <button
                                onClick={() => toggleAvailability(item)}
                                className={`px-2 py-1 rounded-full text-xs ${
                                  item.isAvailable
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {item.isAvailable ? "Available" : "Unavailable"}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => openEditItem(item)}
                                className="p-2 text-slate-500 hover:text-orange-600"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => deleteItem(item._id)}
                                className="p-2 text-slate-500 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))
              )}
            </div>
          ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left p-4 w-14"> </th>
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Category</th>
                  <th className="text-left p-4">Price</th>
                  <th className="text-left p-4">Type</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {categoryFilter === "all"
                        ? "No menu items yet."
                        : "No items in this category."}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item._id}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="p-4">
                        <MenuItemThumb src={item.image} name={item.name} />
                      </td>
                      <td className="p-4 font-medium">{item.name}</td>
                      <td className="p-4">{getCategoryName(item)}</td>
                      <td className="p-4">₹{item.basePrice}</td>
                      <td className="p-4">{item.isVeg ? "Veg" : "Non-Veg"}</td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`px-2 py-1 rounded-full text-xs ${
                            item.isAvailable
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.isAvailable ? "Available" : "Unavailable"}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEditItem(item)}
                          className="p-2 text-slate-500 hover:text-orange-600"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item._id)}
                          className="p-2 text-slate-500 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {itemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingItemId ? "Edit Item" : "Add Menu Item"}
            </h2>
            <form onSubmit={saveItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ingredients & allergens</label>
                <textarea
                  value={itemForm.ingredients}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, ingredients: e.target.value })
                  }
                  placeholder="e.g. Contains dairy, nuts. Shown when guests tap the dish for details."
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="text"
                  placeholder="https://… or /uploads/dish.jpg"
                  value={itemForm.image}
                  onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Full URL or a path on the API host (e.g. <code className="text-[11px]">/uploads/…</code>
                  ). Shown on the guest menu and here as a thumbnail.
                </p>
                {itemForm.image.trim() ? (
                  <div className="mt-3 flex items-center gap-3">
                    <MenuItemThumb src={itemForm.image} name={itemForm.name || "?"} />
                    <span className="text-xs text-slate-400">Preview</span>
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.basePrice}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, basePrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, categoryId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  >
                    {sortedCategories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.isVeg}
                    onChange={(e) => setItemForm({ ...itemForm, isVeg: e.target.checked })}
                  />
                  Vegetarian
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, isAvailable: e.target.checked })
                    }
                  />
                  Available
                </label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingCategoryId ? "Edit Category" : "Add Category"}
            </h2>
            <form onSubmit={saveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  placeholder="e.g. Starters, Main Course"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parent category</label>
                <select
                  value={categoryForm.parentId}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, parentId: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="">None (top-level)</option>
                  {parentCategories
                    .filter((c) => c._id !== editingCategoryId)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sort order</label>
                <input
                  type="number"
                  min={0}
                  value={categoryForm.sortOrder}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

