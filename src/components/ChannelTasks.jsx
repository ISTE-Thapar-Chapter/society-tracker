import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { supabase } from "../supabaseClient";
import ParticleBackground from "./ParticleBackground";

const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"];
const POSITIONS = ["Eb", "Core", "Member"];

const EMPTY_TASK = {
  title: "",
  priority: "P1",
  deadline: "",
  position: "Member",
};

const EMPTY_LINK = {
  title: "",
  url: "",
  position: "Member",
};

const EMPTY_ANNOUNCEMENT = {
  title: "",
  content: "",
  position: "Member",
};

export default function ChannelTasks() {
  const { eventName, channelName } = useParams();

  const [activeTab, setActiveTab] = useState("tasks"); // tasks, links, announcements

  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const [newTask, setNewTask] = useState(EMPTY_TASK);
  const [newLink, setNewLink] = useState(EMPTY_LINK);
  const [newAnnouncement, setNewAnnouncement] = useState(EMPTY_ANNOUNCEMENT);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const [loadingData, setLoadingData] = useState(true);
  const [deployingTask, setDeployingTask] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // 1. Fetch Tasks from Supabase
  const fetchTasks = useCallback(async () => {
    if (!eventName || !channelName) return;

    const { data, error } = await supabase
      .from("channel_tasks")
      .select("*")
      .eq("event_name", eventName)
      .eq("channel_name", channelName)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not fetch channel tasks:", error);
    } else {
      setTasks(data ?? []);
    }
  }, [eventName, channelName]);

  // 2. Fetch Meeting Links from Supabase (public.channel_data)
  const fetchLinks = useCallback(async () => {
    if (!channelName) return;

    const { data, error } = await supabase
      .from("channel_data")
      .select("*")
      .eq("channel_name", channelName)
      .eq("type", "meeting_link")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not fetch meeting links:", error);
    } else {
      setLinks(data ?? []);
    }
  }, [channelName]);

  // 3. Fetch Announcements from Supabase (public.notices)
  const fetchAnnouncements = useCallback(async () => {
    if (!channelName) return;

    const { data, error } = await supabase
      .from("notices")
      .select("*")
      .eq("channel_name", channelName)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not fetch announcements:", error);
    } else {
      setAnnouncements(data ?? []);
    }
  }, [channelName]);

  // Load all backend data on initial load
  const fetchAllData = useCallback(async () => {
    setLoadingData(true);
    setErrorMessage("");
    await Promise.all([fetchTasks(), fetchLinks(), fetchAnnouncements()]);
    setLoadingData(false);
  }, [fetchTasks, fetchLinks, fetchAnnouncements]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- HANDLERS: TASKS ---
  const handleAddTask = async (event) => {
    event.preventDefault();

    const trimmedTitle = newTask.title.trim();
    if (!trimmedTitle || !newTask.deadline || !eventName || !channelName) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    setDeployingTask(true);
    setErrorMessage("");
    setSuccessMessage("");

    const taskToInsert = {
      event_name: eventName,
      channel_name: channelName,
      title: trimmedTitle,
      priority: newTask.priority,
      deadline: newTask.deadline,
    };

    const { error } = await supabase.from("channel_tasks").insert([taskToInsert]);

    if (error) {
      console.error("Task deployment failed:", error);
      setErrorMessage(`Task could not be deployed: ${error.message}`);
    } else {
      setNewTask(EMPTY_TASK);
      setSuccessMessage("Task deployed successfully.");
      await fetchTasks();
    }
    setDeployingTask(false);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    const { error } = await supabase.from("channel_tasks").delete().eq("id", taskId);

    if (error) {
      setErrorMessage(`Task could not be deleted: ${error.message}`);
    } else {
      setSuccessMessage("Task deleted successfully.");
      await fetchTasks();
    }
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleUpdateTask = async (taskId) => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setErrorMessage("Task description cannot be empty.");
      return;
    }

    const { error } = await supabase
      .from("channel_tasks")
      .update({ title: trimmedTitle })
      .eq("id", taskId);

    if (error) {
      setErrorMessage(`Task could not be updated: ${error.message}`);
    } else {
      setEditingId(null);
      setEditTitle("");
      setSuccessMessage("Task updated successfully.");
      await fetchTasks();
    }
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // --- HANDLERS: MEETING LINKS ---
  const handleAddLink = async (event) => {
    event.preventDefault();
    if (!newLink.title || !newLink.url) {
      setErrorMessage("Title and URL are required.");
      return;
    }

    setDeployingTask(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      channel_name: channelName,
      content: `${newLink.title} | ${newLink.url}`,
      type: "meeting_link",
    };

    const { error } = await supabase.from("channel_data").insert([payload]);

    if (error) {
      setErrorMessage(`Meeting link deployment failed: ${error.message}`);
    } else {
      setNewLink(EMPTY_LINK);
      setSuccessMessage("Meeting link deployed successfully!");
      await fetchLinks();
    }
    setDeployingTask(false);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleDeleteLink = async (id) => {
    if (!window.confirm("Delete this meeting link?")) return;

    const { error } = await supabase.from("channel_data").delete().eq("id", id);

    if (error) {
      setErrorMessage(`Failed to delete link: ${error.message}`);
    } else {
      setSuccessMessage("Meeting link deleted!");
      await fetchLinks();
    }
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  // --- HANDLERS: ANNOUNCEMENTS ---
  const handleAddAnnouncement = async (event) => {
    event.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content) {
      setErrorMessage("Title and content are required.");
      return;
    }

    setDeployingTask(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      channel_name: channelName,
      content: `[${newAnnouncement.title}] ${newAnnouncement.content}`,
      created_by: newAnnouncement.position,
    };

    const { error } = await supabase.from("notices").insert([payload]);

    if (error) {
      setErrorMessage(`Announcement deployment failed: ${error.message}`);
    } else {
      setNewAnnouncement(EMPTY_ANNOUNCEMENT);
      setSuccessMessage("Announcement deployed successfully!");
      await fetchAnnouncements();
    }
    setDeployingTask(false);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;

    const { error } = await supabase.from("notices").delete().eq("id", id);

    if (error) {
      setErrorMessage(`Failed to delete announcement: ${error.message}`);
    } else {
      setSuccessMessage("Announcement deleted!");
      await fetchAnnouncements();
    }
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030508] p-6 text-white md:p-8">
      <ParticleBackground />

      <div className="relative z-20 mx-auto mb-10 flex max-w-7xl flex-col items-start justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-500">
            Events / {eventName}
          </p>

          <h1 className={`bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text font-black uppercase text-transparent ${channelName?.length > 14 ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-3xl md:text-5xl'}`}>
            {channelName?.replace(/-/g, " ")}
          </h1>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 md:mt-0">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`relative rounded-full px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "tasks"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            Tasks
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] text-white">
              {tasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("links")}
            className={`relative rounded-full px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "links"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            Meeting Links
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] text-white">
              {links.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("announcements")}
            className={`relative rounded-full px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "announcements"
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            Announcements
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] text-white">
              {announcements.length}
            </span>
          </button>
        </div>

        <Link
          to="/home"
          className="rounded-xl border border-white/10 bg-white/5 px-6 py-2 text-sm transition-all hover:bg-white/10"
        >
          Back to Channels
        </Link>
      </div>

      <div className="relative z-20 mx-auto mb-6 max-w-7xl">
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-300">
            {successMessage}
          </div>
        )}
      </div>

      <div className="relative z-20 mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
        {/* FORM SECTION */}
        <div className="h-fit rounded-3xl border border-white/5 bg-[#0a0f1c]/60 p-8 backdrop-blur-xl">
          <h2 className="mb-6 text-xl font-bold text-cyan-400">
            Deploy New{" "}
            {activeTab === "tasks"
              ? "Task"
              : activeTab === "links"
              ? "Link"
              : "Announcement"}
          </h2>

          {activeTab === "tasks" && (
            <form onSubmit={handleAddTask} className="space-y-4">
              <input
                type="text"
                className="w-full rounded-xl border border-white/5 bg-black/40 p-4 outline-none focus:border-cyan-500"
                placeholder="Task description..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                disabled={deployingTask}
                required
              />
              <select
                className="w-full cursor-pointer appearance-none rounded-xl border border-white/5 bg-black/40 p-4 outline-none"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                disabled={deployingTask}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="bg-[#0a0f1c]">{p}</option>
                ))}
              </select>
              <select
                className="w-full cursor-pointer appearance-none rounded-xl border border-white/5 bg-black/40 p-4 outline-none"
                value={newTask.position}
                onChange={(e) => setNewTask({ ...newTask, position: e.target.value })}
                disabled={deployingTask}
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos} className="bg-[#0a0f1c]">{pos}</option>
                ))}
              </select>
              <input
                type="date"
                className="w-full cursor-pointer rounded-xl border border-white/5 bg-black/40 p-4 text-slate-300 outline-none"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                style={{ colorScheme: "dark" }}
                disabled={deployingTask}
                required
              />
              <button
                type="submit"
                disabled={deployingTask}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 font-bold transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deployingTask ? "Deploying..." : "Deploy Task"}
              </button>
            </form>
          )}

          {activeTab === "links" && (
            <form onSubmit={handleAddLink} className="space-y-4">
              <input
                type="text"
                className="w-full rounded-xl border border-white/5 bg-black/40 p-4 outline-none focus:border-cyan-500"
                placeholder="Meeting Title..."
                value={newLink.title}
                onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                disabled={deployingTask}
                required
              />
              <input
                type="url"
                className="w-full rounded-xl border border-white/5 bg-black/40 p-4 outline-none focus:border-cyan-500"
                placeholder="Meeting URL (https://...)"
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                disabled={deployingTask}
                required
              />
              <select
                className="w-full cursor-pointer appearance-none rounded-xl border border-white/5 bg-black/40 p-4 outline-none"
                value={newLink.position}
                onChange={(e) => setNewLink({ ...newLink, position: e.target.value })}
                disabled={deployingTask}
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos} className="bg-[#0a0f1c]">{pos}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={deployingTask}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 font-bold transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deployingTask ? "Deploying..." : "Deploy Link"}
              </button>
            </form>
          )}

          {activeTab === "announcements" && (
            <form onSubmit={handleAddAnnouncement} className="space-y-4">
              <input
                type="text"
                className="w-full rounded-xl border border-white/5 bg-black/40 p-4 outline-none focus:border-cyan-500"
                placeholder="Announcement Title..."
                value={newAnnouncement.title}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                disabled={deployingTask}
                required
              />
              <textarea
                className="min-h-[100px] w-full rounded-xl border border-white/5 bg-black/40 p-4 outline-none focus:border-cyan-500"
                placeholder="Announcement Content..."
                value={newAnnouncement.content}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                disabled={deployingTask}
                required
              />
              <select
                className="w-full cursor-pointer appearance-none rounded-xl border border-white/5 bg-black/40 p-4 outline-none"
                value={newAnnouncement.position}
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, position: e.target.value })}
                disabled={deployingTask}
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos} className="bg-[#0a0f1c]">{pos}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={deployingTask}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 font-bold transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deployingTask ? "Deploying..." : "Deploy Announcement"}
              </button>
            </form>
          )}
        </div>

        {/* LIST SECTION */}
        <div className="space-y-4 lg:col-span-2">
          {loadingData && (
            <div className="rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-6 text-slate-400">
              Loading data...
            </div>
          )}

          {/* TASKS TAB */}
          {!loadingData && activeTab === "tasks" && (
            <>
              {tasks.length === 0 && (
                <div className="rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-8 text-center">
                  <p className="font-semibold text-slate-300">No tasks deployed yet</p>
                </div>
              )}
              <AnimatePresence>
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group flex items-center justify-between rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-6 transition-all hover:border-white/10"
                  >
                    {editingId === task.id ? (
                      <input
                        type="text"
                        className="w-full rounded border border-cyan-500 bg-black/50 p-2 text-white outline-none"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        autoFocus
                      />
                    ) : (
                      <div>
                        <p className="text-lg font-bold text-white">{task.title}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">📅 {task.deadline}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 pl-4">
                      <span className={`rounded-lg px-3 py-1 text-[10px] font-black ${task.priority === "P1" ? "bg-red-500/20 text-red-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                        {task.priority}
                      </span>
                      {editingId === task.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdateTask(task.id)} className="font-bold text-green-400 hover:text-green-300">Save</button>
                          <button onClick={() => setEditingId(null)} className="font-bold text-slate-400 hover:text-white">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => { setEditingId(task.id); setEditTitle(task.title); }} className="rounded-lg p-2 text-blue-400 hover:bg-white/5">✏️</button>
                          <button onClick={() => handleDeleteTask(task.id)} className="rounded-lg p-2 text-red-400 hover:bg-white/5">🗑️</button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}

          {/* MEETING LINKS TAB */}
          {!loadingData && activeTab === "links" && (
            <>
              {links.length === 0 && (
                <div className="rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-8 text-center">
                  <p className="font-semibold text-slate-300">No meeting links deployed yet</p>
                </div>
              )}
              <AnimatePresence>
                {links.map((link) => {
                  const [linkTitle, linkUrl] = link.content ? link.content.split(" | ") : ["Meeting Link", "#"];
                  return (
                    <motion.div
                      key={link.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group flex items-center justify-between rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-6 transition-all hover:border-cyan-500/30"
                    >
                      <div>
                        <p className="text-lg font-bold text-cyan-300">{linkTitle}</p>
                        <a href={linkUrl} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-cyan-400 underline">
                          {linkUrl}
                        </a>
                      </div>
                      <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => handleDeleteLink(link.id)} className="rounded-lg p-2 text-red-400 hover:bg-white/5">🗑️</button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {/* ANNOUNCEMENTS TAB */}
          {!loadingData && activeTab === "announcements" && (
            <>
              {announcements.length === 0 && (
                <div className="rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-8 text-center">
                  <p className="font-semibold text-slate-300">No announcements deployed yet</p>
                </div>
              )}
              <AnimatePresence>
                {announcements.map((ann) => (
                  <motion.div
                    key={ann.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group flex items-center justify-between rounded-2xl border border-white/5 bg-[#0a0f1c]/40 p-6 transition-all hover:border-cyan-500/30"
                  >
                    <div className="w-full">
                      <div className="flex w-full justify-between">
                        <p className="text-lg font-bold text-cyan-300">
                          {ann.content.startsWith("[") ? ann.content.split("]")[0].replace("[", "") : "Announcement"}
                        </p>
                        <button onClick={() => handleDeleteAnnouncement(ann.id)} className="rounded-lg p-2 text-red-400 opacity-0 transition-opacity hover:bg-white/5 group-hover:opacity-100">🗑️</button>
                      </div>
                      <p className="mt-2 rounded-xl bg-black/20 p-3 text-slate-300">
                        {ann.content.includes("]") ? ann.content.split("]").slice(1).join("]").trim() : ann.content}
                      </p>
                      {ann.created_by && (
                        <p className="mt-3 font-mono text-xs text-cyan-500/70">Target: {ann.created_by}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
