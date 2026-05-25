"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { qrUrls, type QrType } from "@/lib/qr";

const restaurantName =
  process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Pelikan Village";

const menuUrl = qrUrls.menu;
const reviewUrl = qrUrls.review;

interface MenuEntry {
  id: number;
  filename: string;
  originalName: string;
  fileSizeMB: number | null;
  originalSizeMB: number | null;
  uploadedAt: string;
  isActive: boolean;
}

interface FeedbackEntry {
  id: number;
  name: string;
  message: string;
  rating: number;
  createdAt: string;
  isRead: boolean;
}

interface UserEntry {
  id: number;
  username: string;
  phone: string;
  role: string;
  otpEnabled: boolean;
  notificationsEnabled: boolean;
  permissions: string[];
  createdAt: string;
}

interface NotificationEntry {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface SessionInfo {
  userId: number;
  username: string;
  role: string;
  permissions: string[];
}

function formatNairobiTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminDashboardPage() {
  // Inactivity auto-logout
  useInactivityLogout();

  const menuQrRef = useRef<HTMLDivElement>(null);
  const reviewQrRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Session info
  const [session, setSession] = useState<SessionInfo | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "qr" | "menus" | "feedback" | "users"
  >("qr");

  // QR State
  const [qrPasswordModal, setQrPasswordModal] = useState<{
    visible: boolean;
    type: "menu" | "review";
  }>({ visible: false, type: "menu" });
  const [qrPassword, setQrPassword] = useState("");
  const [qrPasswordError, setQrPasswordError] = useState("");
  const [qrPasswordLoading, setQrPasswordLoading] = useState(false);
  const [qrWarningModal, setQrWarningModal] = useState<{
    visible: boolean;
    type: "menu" | "review";
  }>({ visible: false, type: "menu" });
  const [qrGenerated, setQrGenerated] = useState<{
    [key: string]: boolean;
  }>({});
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    type: string;
    entryId: number | null;
    countdown: number;
  }>({ visible: false, type: "", entryId: null, countdown: 30 });

  // Menu state
  const [menus, setMenus] = useState<MenuEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [menuMessage, setMenuMessage] = useState("");
  const [menuError, setMenuError] = useState("");

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);

  // Users state
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    phone: "",
    role: "manager",
    otpEnabled: false,
    notificationsEnabled: true,
    permissions: [] as string[],
  });
  const [userMessage, setUserMessage] = useState("");
  const [userError, setUserError] = useState("");
  const [editingUser, setEditingUser] = useState<UserEntry | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editRole, setEditRole] = useState("manager");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Fetch session info on mount
  useEffect(() => {
    fetchSession();
    fetchMenus();
    fetchFeedback();
    fetchNotifications();
  }, []);

  // Undo countdown timer
  useEffect(() => {
    if (!undoToast.visible) return;
    if (undoToast.countdown <= 0) {
      setUndoToast((prev) => ({ ...prev, visible: false }));
      return;
    }
    const timer = setTimeout(() => {
      setUndoToast((prev) => ({ ...prev, countdown: prev.countdown - 1 }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [undoToast.visible, undoToast.countdown]);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        // Fetch users if admin
        if (data.role === "admin") fetchUsers();
      }
    } catch {
      console.error("Failed to fetch session");
    }
  };

  const fetchMenus = async () => {
    try {
      const res = await fetch("/api/menus");
      if (res.ok) {
        const data = await res.json();
        setMenus(data.menus);
      }
    } catch {
      console.error("Failed to fetch menus");
    }
  };

  const fetchFeedback = async () => {
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback);
        setUnreadFeedbackCount(
          data.feedback.filter((f: FeedbackEntry) => !f.isRead).length
        );
      }
    } catch {
      console.error("Failed to fetch feedback");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      console.error("Failed to fetch users");
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setNotifUnreadCount(data.unreadCount);
      }
    } catch {
      console.error("Failed to fetch notifications");
    }
  };

  // ============ AUTH ============
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin");
  };

  // ============ QR CODES ============
  const handleQrGenerate = (type: QrType) => {
    setQrPasswordModal({ visible: true, type });
    setQrPassword("");
    setQrPasswordError("");
  };

  const handleQrPasswordSubmit = async () => {
    setQrPasswordLoading(true);
    setQrPasswordError("");

    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: qrPassword }),
      });

      if (res.ok) {
        setQrPasswordModal({ visible: false, type: qrPasswordModal.type });
        setQrWarningModal({ visible: true, type: qrPasswordModal.type });
      } else {
        setQrPasswordError("Incorrect password");
      }
    } catch {
      setQrPasswordError("Something went wrong");
    } finally {
      setQrPasswordLoading(false);
    }
  };

  const handleQrConfirm = async () => {
    const type = qrWarningModal.type;
    setQrWarningModal({ visible: false, type });

    // Log QR access; the API stores the permanent URL server-side.
    try {
      const res = await fetch("/api/qr-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrType: type }),
      });

      if (res.ok) {
        const data = await res.json();
        setQrGenerated((prev) => ({ ...prev, [type]: true }));

        // Show undo toast with 30s countdown
        setUndoToast({
          visible: true,
          type,
          entryId: data.entry.id,
          countdown: 30,
        });
      }
    } catch {
      console.error("Failed to log QR generation");
    }
  };

  const handleQrUndo = async () => {
    if (!undoToast.entryId) return;

    try {
      await fetch("/api/qr-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: undoToast.entryId }),
      });

      setQrGenerated((prev) => ({ ...prev, [undoToast.type]: false }));
    } catch {
      console.error("Failed to undo");
    }
    setUndoToast({ visible: false, type: "", entryId: null, countdown: 30 });
  };

  const downloadQR = useCallback(
    (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
      const svg = ref.current?.querySelector("svg");
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();

      img.onload = () => {
        canvas.width = 1024;
        canvas.height = 1024;
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, 1024, 1024);
        }
        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = filename;
        link.href = pngUrl;
        link.click();
      };

      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    },
    []
  );

  const printQRCodes = useCallback(() => {
    window.print();
  }, []);

  // ============ MENUS ============
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMenuMessage("");
    setMenuError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        let message = `"${file.name}" uploaded successfully!`;
        
        // Show compression stats if available
        if (data.optimization) {
          const { originalSizeMB, compressedSizeMB, reductionPercent, note } = data.optimization;
          if (parseFloat(reductionPercent) > 0) {
            message += ` Optimized: ${originalSizeMB}MB → ${compressedSizeMB}MB (${reductionPercent}% reduction)`;
          } else if (note) {
            message += ` Size: ${compressedSizeMB}MB - ${note}`;
          } else {
            message += ` Size: ${compressedSizeMB}MB`;
          }
        }
        
        setMenuMessage(message);
        await fetchMenus();
      } else {
        const data = await res.json();
        setMenuError(data.error || "Upload failed");
      }
    } catch {
      setMenuError("Something went wrong during upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleActivate = async (id: number) => {
    setMenuMessage("");
    setMenuError("");
    try {
      const res = await fetch(`/api/menus/${id}/activate`, { method: "POST" });
      if (res.ok) {
        setMenuMessage("Active menu updated!");
        await fetchMenus();
      } else {
        setMenuError("Failed to set active menu");
      }
    } catch {
      setMenuError("Something went wrong");
    }
  };

  const handleDeleteMenu = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setMenuMessage("");
    setMenuError("");
    try {
      const res = await fetch(`/api/menus/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMenuMessage(`"${name}" deleted.`);
        await fetchMenus();
      } else {
        const data = await res.json();
        setMenuError(data.error || "Failed to delete menu");
      }
    } catch {
      setMenuError("Something went wrong");
    }
  };

  // ============ FEEDBACK ============
  const handleMarkRead = async (id: number) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "PATCH" });
      if (res.ok) await fetchFeedback();
    } catch {
      console.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/feedback", { method: "PATCH" });
      if (res.ok) await fetchFeedback();
    } catch {
      console.error("Failed to mark all as read");
    }
  };

  const handleDeleteFeedback = async (id: number) => {
    if (!confirm("Delete this feedback?")) return;
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
      if (res.ok) await fetchFeedback();
    } catch {
      console.error("Failed to delete feedback");
    }
  };

  // ============ USERS ============
  const handleCreateUser = async () => {
    setUserMessage("");
    setUserError("");

    if (!newUser.username || !newUser.password || !newUser.phone) {
      setUserError("Username, password, and phone number are required");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        setUserMessage(`User "${newUser.username}" created!`);
        setNewUser({
          username: "",
          password: "",
          phone: "",
          role: "manager",
          otpEnabled: false,
          notificationsEnabled: true,
          permissions: [],
        });
        setShowCreateUser(false);
        await fetchUsers();
      } else {
        const data = await res.json();
        setUserError(data.error || "Failed to create user");
      }
    } catch {
      setUserError("Something went wrong");
    }
  };

  const handleToggleUserField = async (
    userId: number,
    field: "otpEnabled" | "notificationsEnabled",
    currentValue: boolean
  ) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !currentValue }),
      });
      if (res.ok) await fetchUsers();
    } catch {
      console.error(`Failed to toggle ${field}`);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUserMessage(`User "${username}" deleted.`);
        await fetchUsers();
      } else {
        const data = await res.json();
        setUserError(data.error || "Failed to delete user");
      }
    } catch {
      setUserError("Something went wrong");
    }
  };

  const handleStartEditUser = (user: UserEntry) => {
    setEditingUser(user);
    setEditPermissions([...user.permissions]);
    setEditRole(user.role);
    setEditPhone(user.phone || "");
    setEditPassword("");
    setUserError("");
  };

  const handleSaveEditUser = async () => {
    if (!editingUser) return;
    setUserError("");

    const body: Record<string, unknown> = {
      permissions: editPermissions,
      role: editRole,
      phone: editPhone,
    };
    if (editPassword) body.password = editPassword;

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setUserMessage(`User "${editingUser.username}" updated.`);
        setEditingUser(null);
        await fetchUsers();
      } else {
        const data = await res.json();
        setUserError(data.error || "Failed to update user");
      }
    } catch {
      setUserError("Something went wrong");
    }
  };

  const toggleEditPermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  // ============ NOTIFICATIONS ============
  const handleMarkAllNotifRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "PATCH" });
      if (res.ok) await fetchNotifications();
    } catch {
      console.error("Failed to mark notifications as read");
    }
  };

  // Permission helpers
  const canViewQr =
    session?.role === "admin" || session?.permissions.includes("generate_qr");
  const canViewFeedback =
    session?.role === "admin" ||
    session?.permissions.includes("view_feedback");
  const canViewMenus = session?.role === "admin";
  const canViewUsers = session?.role === "admin";

  const toggleNewUserPermission = (perm: string) => {
    setNewUser((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="bg-gray-900 shadow-lg border-b border-gray-800 print:hidden relative z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifPanel(!showNotifPanel);
                  if (!showNotifPanel) fetchNotifications();
                }}
                className="relative text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {notifUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {showNotifPanel && (
                <div className="absolute right-0 top-10 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      Notifications
                    </span>
                    {notifUnreadCount > 0 && (
                      <button
                        onClick={handleMarkAllNotifRead}
                        className="text-xs text-amber-400 hover:text-amber-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-600 text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.slice(0, 20).map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-gray-800/50 text-sm ${
                            !n.isRead ? "bg-amber-600/5" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-gray-300 text-xs leading-relaxed">
                                {n.message}
                              </p>
                              <p className="text-gray-600 text-[10px] mt-1">
                                {formatNairobiTime(n.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => window.open("/menu", "_blank", "noopener,noreferrer")}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              View Menu
            </button>

            <span className="text-xs text-gray-500">
              {session?.username} ({session?.role})
            </span>

            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Click outside to close notification panel */}
      {showNotifPanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifPanel(false)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 print:hidden">
          {canViewQr && (
            <button
              onClick={() => setActiveTab("qr")}
              className={`py-2 px-5 rounded-lg font-medium text-sm transition-colors ${
                activeTab === "qr"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700"
              }`}
            >
              QR Codes
            </button>
          )}
          {canViewMenus && (
            <button
              onClick={() => setActiveTab("menus")}
              className={`py-2 px-5 rounded-lg font-medium text-sm transition-colors ${
                activeTab === "menus"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700"
              }`}
            >
              Menu Management
            </button>
          )}
          {canViewFeedback && (
            <button
              onClick={() => setActiveTab("feedback")}
              className={`py-2 px-5 rounded-lg font-medium text-sm transition-colors relative ${
                activeTab === "feedback"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700"
              }`}
            >
              Feedback
              {unreadFeedbackCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadFeedbackCount}
                </span>
              )}
            </button>
          )}
          {canViewUsers && (
            <button
              onClick={() => setActiveTab("users")}
              className={`py-2 px-5 rounded-lg font-medium text-sm transition-colors ${
                activeTab === "users"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700"
              }`}
            >
              User Management
            </button>
          )}
        </div>

        {/* ==================== QR CODES TAB ==================== */}
        {activeTab === "qr" && canViewQr && (
          <>
            <div className="bg-amber-600/10 border border-amber-600/20 rounded-2xl p-5 mb-8 print:hidden">
              <h2 className="font-semibold text-white mb-1">
                Static QR Codes
              </h2>
              <p className="text-sm text-gray-400">
                These QR codes always point to permanent Pelikan Village links.
                Uploading a new menu will not require reprinting them.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Menu QR Code */}
              <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden">
                <div className="bg-amber-600/10 px-6 py-4 border-b border-gray-800">
                  <h3 className="text-lg font-bold text-white">
                    📖 Menu QR Code
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Scan to view the restaurant menu
                  </p>
                </div>
                <div className="p-8 flex flex-col items-center">
                  {qrGenerated.menu ? (
                    <>
                      <div
                        ref={menuQrRef}
                        className="bg-white p-4 rounded-xl"
                      >
                        <QRCodeSVG
                          value={menuUrl}
                          size={220}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <p className="mt-4 text-xs text-gray-500 text-center break-all">
                        {menuUrl}
                      </p>
                      <div className="flex gap-3 mt-6 print:hidden">
                        <button
                          onClick={() =>
                            downloadQR(menuQrRef, "menu-qr-code.png")
                          }
                          className="py-2 px-4 text-sm bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors"
                        >
                          Download PNG
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleQrGenerate("menu")}
                      className="py-3 px-8 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-md"
                    >
                      Show Menu QR Code
                    </button>
                  )}
                </div>
              </div>

              {/* Review QR Code */}
              <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden">
                <div className="bg-emerald-600/10 px-6 py-4 border-b border-gray-800">
                  <h3 className="text-lg font-bold text-white">
                    ⭐ Google Review QR Code
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Scan to leave a Google review
                  </p>
                </div>
                <div className="p-8 flex flex-col items-center">
                  {qrGenerated.review ? (
                    <>
                      <div
                        ref={reviewQrRef}
                        className="bg-white p-4 rounded-xl"
                      >
                        <QRCodeSVG
                          value={reviewUrl}
                          size={220}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <p className="mt-4 text-xs text-gray-500 text-center break-all">
                        {reviewUrl}
                      </p>
                      <div className="flex gap-3 mt-6 print:hidden">
                        <button
                          onClick={() =>
                            downloadQR(reviewQrRef, "review-qr-code.png")
                          }
                          className="py-2 px-4 text-sm bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Download PNG
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleQrGenerate("review")}
                      className="py-3 px-8 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-md"
                    >
                      Show Review QR Code
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Print All */}
            {(qrGenerated.menu || qrGenerated.review) && (
              <div className="mt-8 text-center print:hidden">
                <button
                  onClick={printQRCodes}
                  className="inline-flex items-center gap-2 py-3 px-8 bg-white text-gray-900 font-semibold rounded-xl shadow-lg hover:bg-gray-100 transition-all duration-200"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Print All QR Codes
                </button>
              </div>
            )}

            {/* Config Info */}
            <div className="mt-8 bg-gray-900 rounded-2xl shadow-sm border border-gray-800 p-6 print:hidden">
              <h3 className="font-semibold text-white mb-3">
                Current Configuration
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className="text-gray-500">Restaurant:</span>
                  <span className="font-medium text-gray-200">
                    {restaurantName}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-gray-500">Menu URL:</span>
                  <span className="font-mono text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                    {menuUrl}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-gray-500">Review QR URL:</span>
                  <span className="font-mono text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded break-all">
                    {reviewUrl}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ==================== MENU MANAGEMENT TAB ==================== */}
        {activeTab === "menus" && canViewMenus && (
          <>
            {/* View Customer Menu Button */}
            <div className="mb-6">
              <a
                href="/menu"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 py-3 px-6 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-md cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                View Customer Menu
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>

            {/* Upload Section */}
            <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden mb-8">
              <div className="bg-amber-600/10 px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">
                  📤 Upload New Menu
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a PDF file. The first upload becomes the active menu
                  automatically.
                </p>
              </div>
              <div className="p-6">
                {menuMessage && (
                  <div className="mb-4 bg-emerald-900/30 text-emerald-400 text-sm px-4 py-3 rounded-xl border border-emerald-800/50">
                    {menuMessage}
                  </div>
                )}
                {menuError && (
                  <div className="mb-4 bg-red-900/30 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-800/50">
                    {menuError}
                  </div>
                )}

                <label
                  className={`flex-1 w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    uploading
                      ? "border-gray-700 bg-gray-800/50 cursor-not-allowed"
                      : "border-gray-700 hover:border-amber-500 hover:bg-amber-600/5"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <svg
                    className="w-10 h-10 mx-auto text-gray-600 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  {uploading ? (
                    <p className="text-gray-500 text-sm">Uploading...</p>
                  ) : (
                    <>
                      <p className="text-gray-300 font-medium">
                        Click to upload a PDF menu
                      </p>
                      <p className="text-gray-600 text-sm mt-1">
                        Max file size: 100MB
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Uploaded Menus */}
            <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden">
              <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-bold text-white">
                  📋 Uploaded Menus
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {menus.length === 0
                    ? "No menus uploaded yet."
                    : `${menus.length} menu${menus.length > 1 ? "s" : ""} uploaded.`}
                </p>
              </div>

              {menus.length > 0 && (
                <div className="divide-y divide-gray-800">
                  {menus.map((menu) => (
                    <div
                      key={menu.id}
                      className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                        menu.isActive ? "bg-emerald-900/10" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-red-400 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                          </svg>
                          <span className="font-medium text-gray-200 truncate">
                            {menu.originalName}
                          </span>
                          {menu.isActive && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 ml-7 space-y-0.5">
                          <p>Uploaded {formatNairobiTime(menu.uploadedAt)}</p>
                          {menu.fileSizeMB != null ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-gray-500">Size:</span>
                              {menu.originalSizeMB != null && menu.originalSizeMB > menu.fileSizeMB ? (
                                <span className="text-gray-300">
                                  <span className="line-through text-gray-600">{menu.originalSizeMB.toFixed(2)}MB</span>
                                  <span className="ml-1 text-emerald-400 font-medium">{menu.fileSizeMB.toFixed(2)}MB</span>
                                  <span className="ml-1 text-emerald-400 text-[10px]">
                                    ({(100 - (menu.fileSizeMB / menu.originalSizeMB) * 100).toFixed(1)}% reduced)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-300 font-medium">{menu.fileSizeMB.toFixed(2)}MB</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">Size: Not available</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-7 sm:ml-0">
                        {!menu.isActive && (
                          <>
                            <button
                              onClick={() => handleActivate(menu.id)}
                              className="py-1.5 px-3 text-xs bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              Set Active
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteMenu(menu.id, menu.originalName)
                              }
                              className="py-1.5 px-3 text-xs text-red-400 font-medium rounded-lg border border-red-800/50 hover:bg-red-900/30 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {menu.isActive && (
                          <span className="text-xs text-emerald-500">
                            Currently shown to customers
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ==================== FEEDBACK TAB ==================== */}
        {activeTab === "feedback" && canViewFeedback && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  💬 Customer Feedback
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {feedback.length === 0
                    ? "No feedback received yet."
                    : `${feedback.length} feedback entries. ${
                        unreadFeedbackCount > 0
                          ? `${unreadFeedbackCount} unread.`
                          : "All read."
                      }`}
                </p>
              </div>
              {unreadFeedbackCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="py-1.5 px-4 text-xs bg-gray-800 text-gray-300 font-medium rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {feedback.length > 0 ? (
              <div className="space-y-4">
                {feedback.map((fb) => (
                  <div
                    key={fb.id}
                    className={`bg-gray-900 rounded-xl border overflow-hidden ${
                      fb.isRead
                        ? "border-gray-800"
                        : "border-amber-600/30 shadow-md shadow-amber-600/5"
                    }`}
                  >
                    <div className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-amber-600/20 flex items-center justify-center shrink-0">
                            <span className="text-amber-400 font-bold text-sm">
                              {fb.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm truncate">
                                {fb.name}
                              </span>
                              {!fb.isRead && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star <= fb.rating
                                      ? "text-amber-400"
                                      : "text-gray-700"
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-gray-600 shrink-0 whitespace-nowrap">
                          {formatNairobiTime(fb.createdAt)}
                        </span>
                      </div>

                      <p className="text-gray-300 text-sm leading-relaxed ml-12">
                        {fb.message}
                      </p>

                      <div className="flex items-center gap-2 mt-3 ml-12">
                        {!fb.isRead && (
                          <button
                            onClick={() => handleMarkRead(fb.id)}
                            className="py-1 px-3 text-xs bg-gray-800 text-gray-400 rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-gray-200 transition-colors"
                          >
                            Mark as read
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="py-1 px-3 text-xs text-red-400 rounded-lg border border-red-900/50 hover:bg-red-900/20 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
                <svg
                  className="w-12 h-12 text-gray-700 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-gray-500">No feedback yet.</p>
              </div>
            )}
          </>
        )}

        {/* ==================== USER MANAGEMENT TAB ==================== */}
        {activeTab === "users" && canViewUsers && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  👥 User Management
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create and manage admin and manager accounts.
                </p>
              </div>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="py-2 px-4 text-sm bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add User
              </button>
            </div>

            {userMessage && (
              <div className="mb-4 bg-emerald-900/30 text-emerald-400 text-sm px-4 py-3 rounded-xl border border-emerald-800/50">
                {userMessage}
              </div>
            )}
            {userError && (
              <div className="mb-4 bg-red-900/30 text-red-400 text-sm px-4 py-3 rounded-xl border border-red-800/50">
                {userError}
              </div>
            )}

            {/* Create User Form */}
            {showCreateUser && (
              <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden mb-6">
                <div className="bg-amber-600/10 px-6 py-4 border-b border-gray-800">
                  <h3 className="text-base font-bold text-white">
                    Create New User
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) =>
                          setNewUser({ ...newUser, username: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-amber-600 focus:border-amber-600"
                        placeholder="e.g., manager1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-amber-600 focus:border-amber-600"
                        placeholder="Strong password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Phone (for OTP/SMS) *
                      </label>
                      <input
                        type="text"
                        value={newUser.phone}
                        onChange={(e) =>
                          setNewUser({ ...newUser, phone: e.target.value })
                        }
                        required
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-amber-600 focus:border-amber-600"
                        placeholder="e.g., 254712345678"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Role
                      </label>
                      <select
                        value={newUser.role}
                        onChange={(e) =>
                          setNewUser({ ...newUser, role: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-amber-600 focus:border-amber-600"
                      >
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Permissions (for managers)
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes("view_feedback")}
                          onChange={() => toggleNewUserPermission("view_feedback")}
                          className="rounded bg-gray-800 border-gray-600 text-amber-600 focus:ring-amber-600"
                        />
                        View Feedback
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUser.permissions.includes("generate_qr")}
                          onChange={() => toggleNewUserPermission("generate_qr")}
                          className="rounded bg-gray-800 border-gray-600 text-amber-600 focus:ring-amber-600"
                        />
                        Access Static QR Codes
                      </label>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUser.otpEnabled}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            otpEnabled: e.target.checked,
                          })
                        }
                        className="rounded bg-gray-800 border-gray-600 text-amber-600 focus:ring-amber-600"
                      />
                      Enable OTP (2FA)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUser.notificationsEnabled}
                        onChange={(e) =>
                          setNewUser({
                            ...newUser,
                            notificationsEnabled: e.target.checked,
                          })
                        }
                        className="rounded bg-gray-800 border-gray-600 text-amber-600 focus:ring-amber-600"
                      />
                      Enable SMS Notifications
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleCreateUser}
                      className="py-2 px-6 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors text-sm"
                    >
                      Create User
                    </button>
                    <button
                      onClick={() => setShowCreateUser(false)}
                      className="py-2 px-6 bg-gray-800 text-gray-300 font-medium rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Users List */}
            <div className="bg-gray-900 rounded-2xl shadow-lg border border-gray-800 overflow-hidden">
              <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-800">
                <h3 className="text-base font-bold text-white">
                  All Users ({users.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-800">
                {users.map((user) => (
                  <div key={user.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white text-sm">
                            {user.username}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              user.role === "admin"
                                ? "bg-purple-900/40 text-purple-400 border border-purple-800/50"
                                : "bg-blue-900/40 text-blue-400 border border-blue-800/50"
                            }`}
                          >
                            {user.role}
                          </span>
                          {user.id === session?.userId && (
                            <span className="text-[10px] text-gray-600">
                              (you)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>📱 {user.phone || "No phone"}</span>
                          <span>
                            🔐 OTP:{" "}
                            <span
                              className={
                                user.otpEnabled
                                  ? "text-emerald-400"
                                  : "text-gray-600"
                              }
                            >
                              {user.otpEnabled ? "On" : "Off"}
                            </span>
                          </span>
                          <span>
                            🔔 Notifications:{" "}
                            <span
                              className={
                                user.notificationsEnabled
                                  ? "text-emerald-400"
                                  : "text-gray-600"
                              }
                            >
                              {user.notificationsEnabled ? "On" : "Off"}
                            </span>
                          </span>
                        </div>
                        {/* Permissions badges */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {user.role === "admin" ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] bg-purple-900/30 text-purple-400 border border-purple-800/50">
                              All permissions (admin)
                            </span>
                          ) : user.permissions.length === 0 ? (
                            <span className="text-[10px] text-gray-600 italic">
                              No permissions assigned
                            </span>
                          ) : (
                            user.permissions.map((p) => (
                              <span
                                key={p}
                                className="inline-flex px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 border border-gray-700"
                              >
                                {p.replace("_", " ")}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            handleToggleUserField(
                              user.id,
                              "otpEnabled",
                              user.otpEnabled
                            )
                          }
                          className={`py-1 px-2.5 text-[10px] rounded-lg border transition-colors ${
                            user.otpEnabled
                              ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/50"
                              : "bg-gray-800 text-gray-500 border-gray-700 hover:bg-emerald-900/30 hover:text-emerald-400 hover:border-emerald-800/50"
                          }`}
                          title={
                            user.otpEnabled ? "Disable OTP" : "Enable OTP"
                          }
                        >
                          {user.otpEnabled ? "OTP ✓" : "OTP ✗"}
                        </button>
                        <button
                          onClick={() =>
                            handleToggleUserField(
                              user.id,
                              "notificationsEnabled",
                              user.notificationsEnabled
                            )
                          }
                          className={`py-1 px-2.5 text-[10px] rounded-lg border transition-colors ${
                            user.notificationsEnabled
                              ? "bg-emerald-900/30 text-emerald-400 border-emerald-800/50 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/50"
                              : "bg-gray-800 text-gray-500 border-gray-700 hover:bg-emerald-900/30 hover:text-emerald-400 hover:border-emerald-800/50"
                          }`}
                          title={
                            user.notificationsEnabled
                              ? "Disable Notifications"
                              : "Enable Notifications"
                          }
                        >
                          {user.notificationsEnabled ? "🔔 ✓" : "🔔 ✗"}
                        </button>
                        <button
                          onClick={() => handleStartEditUser(user)}
                          className="py-1 px-2.5 text-[10px] text-amber-400 rounded-lg border border-amber-800/50 hover:bg-amber-900/20 transition-colors"
                        >
                          Edit
                        </button>
                        {user.id !== session?.userId && (
                          <button
                            onClick={() =>
                              handleDeleteUser(user.id, user.username)
                            }
                            className="py-1 px-2.5 text-[10px] text-red-400 rounded-lg border border-red-900/50 hover:bg-red-900/20 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ==================== PASSWORD MODAL ==================== */}
      {qrPasswordModal.visible && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 print:hidden">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              🔐 Confirm Password
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Enter your password to generate a{" "}
              {qrPasswordModal.type === "menu" ? "menu" : "review"} QR code.
            </p>

            {qrPasswordError && (
              <div className="mb-3 bg-red-900/30 text-red-400 text-sm px-3 py-2 rounded-lg border border-red-800/50">
                {qrPasswordError}
              </div>
            )}

            <input
              type="password"
              value={qrPassword}
              onChange={(e) => setQrPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQrPasswordSubmit()}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-amber-600 focus:border-amber-600 mb-4"
              placeholder="Enter your password"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={handleQrPasswordSubmit}
                disabled={qrPasswordLoading || !qrPassword}
                className="flex-1 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {qrPasswordLoading ? "Verifying..." : "Confirm"}
              </button>
              <button
                onClick={() =>
                  setQrPasswordModal({ visible: false, type: "menu" })
                }
                className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STATIC QR CONFIRMATION MODAL ==================== */}
      {qrWarningModal.visible && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 print:hidden">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-600/20 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">
                Permanent QR Link
              </h3>
            </div>
            <p className="text-sm text-gray-300 text-center mb-6">
              This QR code will always point to{" "}
              <span className="text-amber-400 font-semibold">
                {qrWarningModal.type === "menu" ? menuUrl : reviewUrl}
              </span>
              . You can update the menu later without reprinting.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleQrConfirm}
                className="flex-1 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors"
              >
                Show QR Code
              </button>
              <button
                onClick={() =>
                  setQrWarningModal({ visible: false, type: "menu" })
                }
                className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT USER MODAL ==================== */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 print:hidden">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-1">
              ✏️ Edit User
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Editing <span className="text-white font-medium">{editingUser.username}</span>
            </p>

            {userError && (
              <div className="mb-4 bg-red-900/30 text-red-400 text-sm px-3 py-2 rounded-lg border border-red-800/50">
                {userError}
              </div>
            )}

            <div className="space-y-4">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-amber-600 focus:border-amber-600"
                >
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                {editRole === "admin" && (
                  <p className="text-[11px] text-purple-400 mt-1">
                    Admins automatically have all permissions.
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone (for OTP/SMS)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-amber-600 focus:border-amber-600"
                  placeholder="e.g., 254712345678"
                />
              </div>

              {/* New Password (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  New Password <span className="text-gray-600">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-amber-600 focus:border-amber-600"
                  placeholder="New password"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Permissions
                </label>
                {editRole === "admin" ? (
                  <p className="text-xs text-gray-500 italic">
                    Admin role has all permissions by default.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 cursor-pointer hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={editPermissions.includes("view_feedback")}
                        onChange={() => toggleEditPermission("view_feedback")}
                        className="rounded bg-gray-800 border-gray-600 text-amber-600 focus:ring-amber-600 w-4 h-4"
                      />
                      <div>
                        <span className="text-sm text-gray-200">View Feedback</span>
                        <p className="text-[11px] text-gray-500">Can view and manage customer feedback</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 cursor-pointer hover:bg-gray-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={editPermissions.includes("generate_qr")}
                        onChange={() => toggleEditPermission("generate_qr")}
                        className="rounded bg-gray-800 border-gray-600 text-amber-600 focus:ring-amber-600 w-4 h-4"
                      />
                      <div>
                        <span className="text-sm text-gray-200">Access Static QR Codes</span>
                        <p className="text-[11px] text-gray-500">Can view and download static QR codes</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEditUser}
                className="flex-1 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors text-sm"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserError("");
                }}
                className="flex-1 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== UNDO TOAST ==================== */}
      {undoToast.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 print:hidden">
          <div className="bg-gray-800 border border-gray-700 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-4">
            <p className="text-sm text-gray-200">
              Static QR code shown.{" "}
              <button
                onClick={handleQrUndo}
                className="text-amber-400 font-semibold hover:text-amber-300 underline"
              >
                Undo
              </button>
            </p>
            <span className="text-xs text-gray-500 font-mono">
              {undoToast.countdown}s
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
