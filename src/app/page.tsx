"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Moon,
  Sun,
  Download,
  Check,
  Loader2,
  Palette,
  Terminal,
  X,
  ExternalLink,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FolderSync,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ThemeInfo, GitHubTheme } from "@/lib/types";
import { ZoomableImage } from "@/components/zoomable-image";

export default function HomePage() {
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });
  const [osc99, setOsc99] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("osc99") === "true";
  });
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);

  const [ghThemes, setGhThemes] = useState<GitHubTheme[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghSearch, setGhSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [ghDialogOpen, setGhDialogOpen] = useState(false);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const toggleOsc99 = () => {
    const next = !osc99;
    setOsc99(next);
    localStorage.setItem("osc99", next ? "true" : "false");
  };

  const fetchThemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/themes");
      const data = await res.json();
      const nextThemes = data.themes || [];
      setThemes(nextThemes);
      const active = nextThemes.find((theme: ThemeInfo) => theme.isActive);
      setActiveTheme(active?.name || null);
    } catch (error) {
      console.error("Failed to fetch themes:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fetchThemes();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fetchThemes]);

  const switchTheme = async (theme: ThemeInfo) => {
    setSwitching(theme.name);
    try {
      const res = await fetch("/api/profile/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Oh-My-Theme-Request": "1",
        },
        body: JSON.stringify({ themeName: theme.name, osc99 }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTheme(theme.name);
        setThemes((previous) =>
          previous.map((current) => ({
            ...current,
            isActive: current.name === theme.name,
          })),
        );
      } else {
        alert(data.error || "Failed to apply theme");
      }
    } catch {
      alert("Failed to apply theme");
    } finally {
      setSwitching(null);
    }
  };

  const openDetail = useCallback((theme: ThemeInfo) => {
    setSelectedTheme(theme);
  }, []);

  const fetchGitHubThemes = async () => {
    setGhLoading(true);
    try {
      const res = await fetch("/api/github");
      const data = await res.json();
      setGhThemes(data.themes || []);
    } catch (error) {
      console.error("Failed to fetch GitHub themes:", error);
    } finally {
      setGhLoading(false);
    }
  };

  const downloadTheme = async (themeName: string) => {
    setDownloading(themeName);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Oh-My-Theme-Request": "1",
        },
        body: JSON.stringify({ themeName }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchThemes();
      } else {
        alert(data.error || "Failed to install theme");
      }
    } catch {
      alert("Failed to install theme");
    } finally {
      setDownloading(null);
    }
  };

  const installPreviewTheme = async (theme: ThemeInfo) => {
    setInstalling(theme.name);
    try {
      const res = await fetch(`/api/themes/${encodeURIComponent(theme.name)}/install`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Oh-My-Theme-Request": "1",
        },
        body: JSON.stringify({ osc99 }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "Failed to install theme");
        return;
      }

      await fetchThemes();
      const updatedTheme = {
        ...theme,
        path: data.path || theme.path,
        isInstalled: true,
      };
      setSelectedTheme(updatedTheme);
    } catch {
      alert("Failed to install theme");
    } finally {
      setInstalling(null);
    }
  };

  const installedThemeNames = new Set(
    themes
      .filter((theme) => theme.isInstalled)
      .map((theme) => theme.name.toLowerCase()),
  );
  const filteredThemes = themes.filter((theme) => {
    const matchesSearch = theme.name.toLowerCase().includes(search.toLowerCase());
    return tab === "active" ? matchesSearch && theme.isActive : matchesSearch;
  });
  const filteredGhThemes = ghThemes.filter((theme) =>
    theme.name.toLowerCase().includes(ghSearch.toLowerCase()),
  );
  const selectedThemeIndex = selectedTheme
    ? filteredThemes.findIndex((theme) => theme.name === selectedTheme.name)
    : -1;

  const navigatePreview = (direction: -1 | 1) => {
    if (selectedThemeIndex < 0 || filteredThemes.length < 2) return;
    const nextIndex =
      (selectedThemeIndex + direction + filteredThemes.length) % filteredThemes.length;
    void openDetail(filteredThemes[nextIndex]);
  };

  useEffect(() => {
    if (!selectedTheme) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const themesToNavigate = filteredThemes;
      const index = selectedTheme
        ? themesToNavigate.findIndex((theme) => theme.name === selectedTheme.name)
        : -1;
      if (index < 0 || themesToNavigate.length < 2) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const nextIndex = (index + direction + themesToNavigate.length) % themesToNavigate.length;
        void openDetail(themesToNavigate[nextIndex]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredThemes, openDetail, selectedTheme]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Oh My Theme</h1>
              <p className="text-xs text-muted-foreground">Oh My Posh Theme Browser</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTheme && (
              <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
                <Sparkles className="h-3 w-3" />
                {activeTheme}
              </Badge>
            )}
            <Dialog
              open={ghDialogOpen}
              onOpenChange={(open) => {
                setGhDialogOpen(open);
                if (open && ghThemes.length === 0) void fetchGitHubThemes();
              }}
            >
              <DialogTrigger
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5",
                })}
              >
                <Download className="h-4 w-4" />
                Download Themes
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Download Themes from GitHub
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search GitHub themes..."
                      value={ghSearch}
                      onChange={(event) => setGhSearch(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {ghLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-1">
                        {filteredGhThemes.map((theme) => {
                          const isInstalled = installedThemeNames.has(theme.name.toLowerCase());
                          return (
                            <div
                              key={theme.name}
                              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm">{theme.name}</span>
                                {isInstalled && (
                                  <Badge variant="secondary" className="text-xs">
                                    Installed
                                  </Badge>
                                )}
                              </div>
                              {isInstalled ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  disabled={downloading === theme.name}
                                  onClick={() => void downloadTheme(theme.name)}
                                >
                                  {downloading === theme.name ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                  Install
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant={osc99 ? "default" : "ghost"}
              size="icon"
              onClick={toggleOsc99}
              aria-label="Toggle OSC99 directory inheritance"
              title={osc99 ? "OSC99: on — splits inherit current directory" : "OSC99: off — use theme default"}
            >
              <FolderSync className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle color theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search theme names..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All ({themes.length})</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <div className="h-[72px] bg-muted animate-pulse" />
                <CardContent className="p-4">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredThemes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Terminal className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">No matching themes found</p>
            <p className="text-sm mt-1">Try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredThemes.map((theme) => (
              <ThemeCard
                key={theme.name}
                theme={theme}
                isActive={theme.name === activeTheme}
                isSwitching={switching === theme.name}
                isInstalling={installing === theme.name}
                onSwitch={() => void switchTheme(theme)}
                onInstall={() => void installPreviewTheme(theme)}
                onViewDetail={() => void openDetail(theme)}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={Boolean(selectedTheme)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTheme(null);
          }
        }}
      >
        <DialogContent className="flex h-[min(90vh,900px)] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-col overflow-hidden p-4 sm:max-w-6xl sm:p-6">
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle className="flex min-w-0 items-center gap-2 font-mono">
              <Palette className="h-5 w-5 shrink-0" />
              <span className="truncate">{selectedTheme?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedTheme && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              <div className="flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-lg border bg-[#1e1e2e] p-4 sm:min-h-[440px] sm:p-6">
                <ZoomableImage
                  key={selectedTheme.name}
                  src={selectedTheme.previewUrl}
                  alt={selectedTheme.name}
                  containerClassName="flex h-full w-full items-center justify-center"
                  className="max-h-full max-w-full"
                />
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {selectedTheme.isInstalled ? (
                  <Button
                    className="gap-1.5"
                    disabled={selectedTheme.name === activeTheme || switching === selectedTheme.name}
                    onClick={() => void switchTheme(selectedTheme)}
                  >
                    {switching === selectedTheme.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : selectedTheme.name === activeTheme ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {selectedTheme.name === activeTheme ? "Current theme" : "Apply theme"}
                  </Button>
                ) : (
                  <Button
                    className="gap-1.5"
                    disabled={installing === selectedTheme.name}
                    onClick={() => void installPreviewTheme(selectedTheme)}
                  >
                    {installing === selectedTheme.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Install theme
                  </Button>
                )}
                {selectedThemeIndex >= 0 && filteredThemes.length > 1 && (
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => navigatePreview(-1)}
                      aria-label="Previous theme"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-16 text-center text-xs text-muted-foreground">
                      {selectedThemeIndex + 1} / {filteredThemes.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => navigatePreview(1)}
                      aria-label="Next theme"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-2">
                  {selectedTheme.colors.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">Colors:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTheme.colors.map((color, index) => (
                          <div
                            key={`${color}-${index}`}
                            className="h-5 w-5 shrink-0 rounded-full border"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTheme.segmentTypes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Segments:</span>
                      {selectedTheme.segmentTypes.map((segment) => (
                        <Badge key={segment} variant="outline" className="max-w-full text-xs font-mono">
                          {segment}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={() => {
                    window.open(
                      `https://github.com/JanDeDobbeleer/oh-my-posh/blob/main/themes/${selectedTheme.filename}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  GitHub
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Oh My Theme — Visual browser for Oh My Posh themes
      </footer>
    </div>
  );
}

function ThemeCard({
  theme,
  isActive,
  isSwitching,
  isInstalling,
  onSwitch,
  onInstall,
  onViewDetail,
}: {
  theme: ThemeInfo;
  isActive: boolean;
  isSwitching: boolean;
  isInstalling: boolean;
  onSwitch: () => void;
  onInstall: () => void;
  onViewDetail: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="relative block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onViewDetail}
        aria-label={`Preview ${theme.name}`}
      >
        <ZoomableImage
          src={theme.previewUrl}
          alt={theme.name}
          containerClassName="h-[100px] flex items-center justify-center"
          className="max-h-[100px]"
        />
        {isActive && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0 gap-1">
              <Check className="h-2.5 w-2.5" />
              Active
            </Badge>
          </div>
        )}
      </button>

      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onViewDetail}
            className="font-mono text-sm font-medium hover:underline truncate"
          >
            {theme.name}
          </button>
          <Button
            size="sm"
            variant={isActive ? "secondary" : "default"}
            className="h-7 gap-1 text-xs shrink-0 ml-2"
            disabled={isActive || isSwitching || isInstalling}
            onClick={theme.isInstalled ? onSwitch : onInstall}
          >
            {isInstalling || isSwitching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isActive ? (
              <Check className="h-3 w-3" />
            ) : theme.isInstalled ? (
              <Sparkles className="h-3 w-3" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {isActive ? "Active" : theme.isInstalled ? "Apply" : "Install"}
          </Button>
        </div>

        {theme.colors.length > 0 && (
          <div className="flex gap-1 mt-2">
            {theme.colors.slice(0, 5).map((color, index) => (
              <div
                key={`${color}-${index}`}
                className="h-2.5 w-2.5 rounded-full border border-white/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
