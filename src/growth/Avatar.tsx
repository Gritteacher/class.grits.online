import { useId } from "react";
import { Star } from "lucide-react";
import { moods, type Appearance, type Mood } from "./model";

export function Avatar({
  appearance,
  mood,
  name,
}: {
  appearance: Appearance;
  mood: Mood;
  name: string;
}) {
  const clip = useId();
  const face = appearance.automatic ? mood : "neutral";
  const happy = face === "celebrate" || face === "confident";
  return (
    <div className={`growth-avatar avatar-${face}`}>
      <svg
        viewBox="0 0 220 230"
        role="img"
        aria-label={`อวตาร์ ${name} · ${appearance.automatic ? moods[face].name : "สีหน้าคงที่"}`}
      >
        <defs>
          <clipPath id={clip}>
            <rect x="10" y="8" width="200" height="214" rx="76" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect
            x="10"
            y="8"
            width="200"
            height="214"
            rx="76"
            fill={appearance.backdrop}
          />
          {appearance.hair === "bob" && (
            <path
              d="M48 101C43 21 170 19 175 92L180 164Q154 181 42 160Z"
              fill="#263c3a"
            />
          )}
          <path
            d="M48 231V197Q50 159 89 159H133Q173 160 177 197V232"
            fill={appearance.shirt}
          />
          <path d="M92 140V162Q110 178 128 162V140" fill={appearance.skin} />
          <path
            d="M85 162Q108 184 137 161"
            fill="none"
            stroke="#163a35"
            strokeOpacity=".25"
            strokeWidth="4"
          />
          {face === "celebrate" ? (
            <>
              <path
                d="M62 185Q30 167 30 137M159 185Q189 168 190 136"
                stroke={appearance.shirt}
                strokeWidth="21"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="29" cy="133" r="11" fill={appearance.skin} />
              <circle cx="190" cy="132" r="11" fill={appearance.skin} />
            </>
          ) : (
            <path
              d="M60 190L52 224M160 190L168 224"
              stroke="#163a35"
              strokeOpacity=".17"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
          <ellipse cx="61" cy="111" rx="11" ry="14" fill={appearance.skin} />
          <ellipse cx="159" cy="111" rx="11" ry="14" fill={appearance.skin} />
          <rect
            x="62"
            y="48"
            width="96"
            height="109"
            rx="44"
            fill={appearance.skin}
          />
          {appearance.hair === "short" && (
            <path
              d="M58 92Q44 41 92 37Q147 19 163 65L158 95L141 65Q108 86 76 69L68 96Z"
              fill="#263c3a"
            />
          )}
          {appearance.hair === "bob" && (
            <path
              d="M58 98L65 58Q116 21 159 65L161 105Q145 82 137 61Q107 85 65 80Z"
              fill="#263c3a"
            />
          )}
          {appearance.hair === "curly" && (
            <g fill="#263c3a">
              {[
                [64, 68],
                [78, 48],
                [101, 43],
                [125, 43],
                [148, 55],
                [157, 75],
              ].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="19" />
              ))}
            </g>
          )}
          <g
            stroke="#263c3a"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          >
            {face === "thoughtful" ? (
              <>
                <path d="M81 94L94 90M125 90L138 94" />
                <path d="M87 106V111M131 106V111" />
              </>
            ) : happy ? (
              <>
                <path d="M81 108Q88 97 96 108M124 108Q132 97 140 108" />
              </>
            ) : (
              <>
                <path d="M82 94H94M127 94H139" />
                <path d="M88 105V112M132 105V112" />
              </>
            )}
            {face === "celebrate" ? (
              <path d="M96 125Q110 147 126 125Z" fill="#aa584e" />
            ) : face === "confident" ? (
              <path d="M98 129Q111 139 123 127" />
            ) : face === "thoughtful" ? (
              <path d="M104 132Q111 129 118 131" />
            ) : face === "focused" ? (
              <path d="M101 131Q111 135 121 130" />
            ) : (
              <path d="M103 130Q110 134 118 130" />
            )}
          </g>
          <ellipse
            cx="78"
            cy="123"
            rx="8"
            ry="4"
            fill="#dc795f"
            opacity=".35"
          />
          <ellipse
            cx="143"
            cy="123"
            rx="8"
            ry="4"
            fill="#dc795f"
            opacity=".35"
          />
          {appearance.accessory === "glasses" && (
            <g fill="none" stroke="#243e3b" strokeWidth="3">
              <rect x="74" y="97" width="29" height="23" rx="9" />
              <rect x="118" y="97" width="29" height="23" rx="9" />
              <path d="M103 106H118M65 101L74 104M147 104L157 101" />
            </g>
          )}
          <path
            d="M96 209H124"
            stroke="#fff"
            strokeWidth="4"
            strokeOpacity=".55"
            strokeLinecap="round"
          />
        </g>
      </svg>
      {appearance.accessory === "star" && (
        <span className="avatar-star">
          <Star fill="currentColor" size={25} />
        </span>
      )}
    </div>
  );
}
