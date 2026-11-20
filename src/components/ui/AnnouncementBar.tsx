import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import "./AnnouncementBar.css";

type Announcement = {
  id: string;
  message: string;
  sort_order: number;
  background_color: string;
  text_color: string;
};

const DEFAULT_BACKGROUND_COLOR = "#064b27";
const DEFAULT_TEXT_COLOR = "#ffffff";

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, message, sort_order, background_color, text_color"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && isMounted) {
        setAnnouncements(data || []);
      }

      if (error) {
        console.error("Erreur chargement annonces :", error.message);
      }
    }

    load();

    // Mise à jour automatique lorsque l'admin modifie une annonce.
    const channel = supabase
      .channel("storefront-announcements")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcements",
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (announcements.length === 0) return null;

  // Toutes les annonces partagent les couleurs de la première annonce.
  const backgroundColor =
    announcements[0].background_color || DEFAULT_BACKGROUND_COLOR;

  const textColor =
    announcements[0].text_color || DEFAULT_TEXT_COLOR;

  return (
    <div
      className="bufanda-announcement"
      role="region"
      aria-label="Informations de la boutique"
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      <div className="announcement-track">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="announcement-group"
            aria-hidden={copy === 1}
          >
            {announcements.map((item) => (
              <span
                key={item.id}
                className="announcement-item"
                style={{ color: textColor }}
              >
                <span
                  className="announcement-dot"
                  style={{
                    backgroundColor: textColor,
                    boxShadow: `0 0 10px ${textColor}80`,
                  }}
                />

                {item.message}

                <span
                  className="announcement-separator"
                  style={{ color: textColor }}
                >
                  ✦
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
