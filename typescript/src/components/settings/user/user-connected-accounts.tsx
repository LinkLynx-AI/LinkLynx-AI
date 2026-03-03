"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Unlink } from "lucide-react";

interface Service {
  id: string;
  name: string;
  color: string;
}

interface ConnectedAccount {
  serviceId: string;
  serviceName: string;
  username: string;
  visible: boolean;
}

const SERVICES: Service[] = [
  { id: "spotify", name: "Spotify", color: "#1DB954" },
  { id: "steam", name: "Steam", color: "#171A21" },
  { id: "github", name: "GitHub", color: "#333333" },
  { id: "twitter", name: "Twitter/X", color: "#1DA1F2" },
  { id: "youtube", name: "YouTube", color: "#FF0000" },
  { id: "twitch", name: "Twitch", color: "#9146FF" },
  { id: "reddit", name: "Reddit", color: "#FF4500" },
  { id: "playstation", name: "PlayStation", color: "#003087" },
  { id: "xbox", name: "Xbox", color: "#107C10" },
  { id: "epic", name: "Epic Games", color: "#2F2D2E" },
  { id: "battlenet", name: "Battle.net", color: "#148EFF" },
  { id: "riot", name: "Riot Games", color: "#D32936" },
];

const INITIAL_CONNECTED: ConnectedAccount[] = [
  { serviceId: "github", serviceName: "GitHub", username: "user123", visible: true },
  { serviceId: "spotify", serviceName: "Spotify", username: "music_lover", visible: false },
];

export function UserConnectedAccounts() {
  const [connected, setConnected] = useState<ConnectedAccount[]>(INITIAL_CONNECTED);

  const connectedIds = new Set(connected.map((a) => a.serviceId));

  const handleDisconnect = (serviceId: string) => {
    setConnected((prev) => prev.filter((a) => a.serviceId !== serviceId));
  };

  const handleToggleVisibility = (serviceId: string) => {
    setConnected((prev) =>
      prev.map((a) =>
        a.serviceId === serviceId ? { ...a, visible: !a.visible } : a
      )
    );
  };

  const handleConnect = (service: Service) => {
    // In real app, this would open OAuth flow
    setConnected((prev) => [
      ...prev,
      {
        serviceId: service.id,
        serviceName: service.name,
        username: "connected_user",
        visible: true,
      },
    ]);
  };

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">
        接続済みアカウント
      </h2>

      {/* Connected accounts list */}
      {connected.length > 0 && (
        <div className="mb-8 space-y-2">
          {connected.map((account) => (
            <div
              key={account.serviceId}
              className="flex items-center justify-between rounded-lg bg-discord-bg-secondary p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
                  style={{
                    backgroundColor:
                      SERVICES.find((s) => s.id === account.serviceId)?.color ?? "#666",
                  }}
                >
                  {account.serviceName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-discord-text-normal">
                    {account.serviceName}
                  </p>
                  <p className="text-xs text-discord-text-muted">
                    {account.username}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-discord-text-muted">
                    プロフィールに表示
                  </span>
                  <Toggle
                    checked={account.visible}
                    onChange={() => handleToggleVisibility(account.serviceId)}
                  />
                </div>
                <button
                  onClick={() => handleDisconnect(account.serviceId)}
                  className="flex items-center gap-1 text-sm text-discord-brand-red hover:underline"
                >
                  <Unlink size={14} />
                  切断
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Services grid */}
      <h3 className="mb-3 text-sm font-bold uppercase text-discord-header-secondary">
        サービスを接続
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {SERVICES.filter((s) => !connectedIds.has(s.id)).map((service) => (
          <div
            key={service.id}
            className="flex items-center gap-3 rounded-lg bg-discord-bg-secondary p-3"
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
              style={{ backgroundColor: service.color }}
            >
              {service.name.charAt(0)}
            </div>
            <span className="flex-1 truncate text-sm text-discord-text-normal">
              {service.name}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleConnect(service)}
            >
              接続
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
