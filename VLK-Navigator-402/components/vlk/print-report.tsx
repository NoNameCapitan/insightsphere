import React from "react";

/** Keep literal wording intact; shorten only the visible official URL in print. */
export function PrintReport({ text }: { text: string }) {
  return <div className="vlk-report-text">
    {text.split("\n").map((line, index) => <p key={index}>
      {line ? line.split(/(https:\/\/zakon\.rada\.gov\.ua\/\S+)/g).map((part, partIndex) =>
        part.startsWith("https://zakon.rada.gov.ua/")
          ? <a key={partIndex} href={part}>Офіційне джерело · zakon.rada.gov.ua</a>
          : part,
      ) : <br />}
    </p>)}
  </div>;
}
