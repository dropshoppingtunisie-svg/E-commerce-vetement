
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "./AnnouncementBar.css";

type Announcement = {
  id: string;
  message: string;
  sort_order: number;
};

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, message, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error) {
        setAnnouncements(data || []);
      }
    }

    load();

    // Update the storefront when an admin changes an announcement.
    const channel = supabase
      .channel("storefront-announcements")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (announcements.length === 0) return null;

  return (
    <div className="bufanda-announcement" role="region" aria-label="Informations de la boutique">

      <div className="announcement-track">

        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="announcement-group"
            aria-hidden={copy === 1}
          >
            {announcements.map((item) => (
              <span key={item.id} className="announcement-item">
                <span className="announcement-dot" />
                {item.message}
                <span className="announcement-separator">✦</span>
              </span>
            ))}
          </div>
        ))}

      </div>

    </div>
  );
}
