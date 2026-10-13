"use client";

import Image from "next/image";

export function RunningMascot() {
  return (
    <div className="motm-mascot-track" aria-hidden="true">
      <div className="motm-running-mascot">
        <Image
          src="/motm-mascot.png"
          alt=""
          width={629} height={733}
          priority={false}
          draggable={false}
        />
        <span className="motm-mascot-dust" />
      </div>
    </div>
  );
}
