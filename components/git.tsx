import React, { useState, useEffect, useCallback } from "react";
import { GitCommit } from "lucide-react";

interface Commit {
  id: string;
  message: string;
  repo: string;
  timestamp: Date;
}

interface GitHubRepo {
  full_name: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}

export const GitHistory: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setIsRefreshing] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const fetchCommits = async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch(
          "https://api.github.com/user/repos?per_page=100",
          {
            headers: {
              Authorization: `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `GitHub API responded with status ${response.status}`
          );
        }

        const repos = await response.json();

        if (!Array.isArray(repos)) {
          throw new Error("GitHub API did not return an array of repositories");
        }

        const allCommits = await Promise.all(
          repos.map(async (repo: GitHubRepo) => {
            try {
              const commitsResponse = await fetch(
                `https://api.github.com/repos/${repo.full_name}/commits?per_page=25`,
                {
                  headers: {
                    Authorization: `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`,
                    Accept: "application/vnd.github.v3+json",
                  },
                }
              );

              if (!commitsResponse.ok) {
                console.warn(
                  `Failed to fetch commits for ${repo.full_name}:`,
                  await commitsResponse.json()
                );
                return [];
              }

              const commits = await commitsResponse.json();
              return commits.map((commit: GitHubCommit) => ({
                id: commit.sha,
                message: commit.commit.message,
                repo: repo.full_name,
                timestamp: new Date(commit.commit.author.date),
              }));
            } catch (error) {
              console.warn(
                `Error fetching commits for ${repo.full_name}:`,
                error
              );
              return [];
            }
          })
        );

        const flattenedCommits = allCommits
          .flat()
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 25);

        setCommits(flattenedCommits);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching commits:", err);
        setError("Failed to load commit history");
        setLoading(false);
      }
      setTimeout(() => setIsRefreshing(false), 1000);
    };

    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setLastUpdated(new Date());
      setTimeout(() => setIsBlinking(false), 1000);
    }, 3000);

    fetchCommits();
    const fetchInterval = setInterval(fetchCommits, 300000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(blinkInterval);
    };
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    // Cleanup
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFullscreen]);

  const handleClickOutside = useCallback(
    (e: React.MouseEvent) => {
      if (onClose && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Add escape key handler
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (onClose) {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [onClose]);

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
        onClick={handleClickOutside}
      >
        <div
          className={`
            ${isFullscreen ? "fixed inset-4" : "w-[750px] max-h-[60vh]"}
            [background-color:var(--color-background-light)]
            dark:[background-color:var(--color-background-dark)]
            flex flex-col
            border border-gray-800 dark:border-gray-200
          `}
        >
          <div className="flex items-center justify-between border-b border-gray-800 dark:border-gray-200 p-2">
            <div className="flex items-center gap-2 font-mono text-sm">
              <GitCommit
                className={`w-4 h-4 ${
                  isBlinking ? "text-green-500" : "text-gray-500"
                }`}
              />
              <span>Git Commit History</span>
              <span className="text-xs text-gray-500">
                (Last updated: {lastUpdated.toLocaleTimeString()})
              </span>
            </div>
            <div className="flex gap-2 font-mono">
              <button
                className="px-2 hover:bg-gray-100 dark:hover:bg-gray-900"
                disabled
              >
                {isFullscreen ? "□" : "⊡"}
              </button>
              <button
                onClick={handleClose}
                className="px-2 hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="mb-4 font-mono text-xs animate-pulse">
                <div className="flex items-baseline gap-4">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-40"></div>
                </div>
                <div className="mt-1 pl-4 border-l border-gray-300 dark:border-gray-700">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="w-[800px] [background-color:var(--color-background-light)] dark:[background-color:var(--color-background-dark)] border border-gray-800 dark:border-gray-200 flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 dark:border-gray-200 p-2">
            <div className="flex items-center gap-2 font-mono text-sm">
              <span>Error</span>
            </div>
          </div>
          <div className="p-4 font-mono text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 border border-gray-800 dark:border-gray-200 [background-color:var(--color-background-light)] dark:[background-color:var(--color-background-dark)] p-2 cursor-pointer font-mono text-sm"
      >
        Commit History
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={handleClickOutside}
    >
      <div
        className={`
        ${isFullscreen ? "fixed inset-4" : "w-[750px] max-h-[60vh]"}
             [background-color:var(--color-background-light)]
        dark:[background-color:var(--color-background-dark)]
        flex flex-col
        border border-gray-800 dark:border-gray-200
      `}
      >
        {/* Title Bar */}
        <div className="flex items-center justify-between border-b border-gray-800 dark:border-gray-200 p-2">
          <div className="flex items-center gap-2 font-mono text-sm">
            <GitCommit
              className={`w-4 h-4 ${
                isBlinking ? "text-green-500" : "text-gray-500"
              }`}
            />
            <span>Git Commit History</span>
            <span className="text-xs text-gray-500">
              (Last updated: {lastUpdated.toLocaleTimeString()})
            </span>
          </div>
          <div className="flex gap-2 font-mono">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-2 hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              {isFullscreen ? "□" : "⊡"}
            </button>
            <button
              onClick={handleClose}
              className="px-2 hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4">
          {commits.map((commit) => (
            <div key={commit.id} className="mb-4 font-mono text-xs">
              <div className="flex items-baseline gap-4">
                <span className="text-pink-500">{commit.repo}</span>
                <span className="text-gray-500">
                  {commit.timestamp.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 pl-4 border-l border-gray-300 dark:border-gray-700">
                {commit.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GitHistory;
