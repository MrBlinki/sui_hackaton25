// components/SearchTrack.tsx
"use client";

import React, { useState } from "react";

type SearchTrackProps = {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string; // optional for styling hooks
};

const SearchTrack: React.FC<SearchTrackProps> = ({
  onSearch,
  placeholder = "Search track by title…",
  defaultValue = "",
  className = ""
}) => {
  const [value, setValue] = useState(defaultValue);

  const trigger = () => {
    onSearch(value.trim());
  };

  return (
    <div className={`search-track ${className}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") trigger();
        }}
        placeholder={placeholder}
        className="search-track__input"
        style={{
          flex: 1,
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderRadius: 8,
          outline: "none"
        }}
      />
      <button
        type="button"
        onClick={trigger}
        className="search-track__btn"
        aria-label="Search"
        title="Search"
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          background: "white",
          cursor: "pointer"
        }}
      >
        🔎
      </button>
    </div>
  );
};

export default SearchTrack;
