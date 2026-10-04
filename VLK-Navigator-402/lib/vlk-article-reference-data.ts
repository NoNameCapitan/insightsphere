/** Audited navigation metadata for the unchanged 22.08.2025 corpus.
 * Indices point to full literal paragraphs, loaded only with the selected article.
 * These links never select a point, graph or normative result for the clinician.
 * Complete evidence and corpus coverage: review/article-relations-audit.json.
 */
export type ExplanationReferenceIndex = {
  target: string;
  paragraphIndex: number;
  targetPoints?: readonly string[];
  contextParagraphIndices?: readonly number[];
};
export const EXPLANATION_REFERENCE_INDEX: Readonly<Record<string, readonly ExplanationReferenceIndex[]>> = {
  "8": [
    {
      "target": "11",
      "paragraphIndex": 16
    },
    {
      "target": "11",
      "paragraphIndex": 18
    }
  ],
  "11": [
    {
      "target": "8",
      "paragraphIndex": 0,
      "targetPoints": [
        "а",
        "б",
        "в"
      ]
    },
    {
      "target": "9",
      "paragraphIndex": 0,
      "targetPoints": [
        "а",
        "б",
        "в"
      ]
    },
    {
      "target": "10",
      "paragraphIndex": 0,
      "targetPoints": [
        "а",
        "б",
        "в"
      ]
    }
  ],
  "12": [
    {
      "target": "46",
      "paragraphIndex": 40
    }
  ],
  "13": [
    {
      "target": "82",
      "paragraphIndex": 46
    }
  ],
  "24": [
    {
      "target": "23",
      "paragraphIndex": 2
    }
  ],
  "25": [
    {
      "target": "32",
      "paragraphIndex": 18
    }
  ],
  "26": [
    {
      "target": "8",
      "paragraphIndex": 1
    },
    {
      "target": "10",
      "paragraphIndex": 1
    },
    {
      "target": "32",
      "paragraphIndex": 19
    },
    {
      "target": "31",
      "paragraphIndex": 21
    }
  ],
  "29": [
    {
      "target": "31",
      "paragraphIndex": 2
    }
  ],
  "33": [
    {
      "target": "57",
      "paragraphIndex": 0
    }
  ],
  "34": [
    {
      "target": "37",
      "paragraphIndex": 1
    }
  ],
  "40": [
    {
      "target": "38",
      "paragraphIndex": 1
    }
  ],
  "41": [
    {
      "target": "44",
      "paragraphIndex": 15
    }
  ],
  "51": [
    {
      "target": "56",
      "paragraphIndex": 14,
      "contextParagraphIndices": [
        13
      ]
    }
  ],
  "52": [
    {
      "target": "56",
      "paragraphIndex": 27
    }
  ],
  "60": [
    {
      "target": "61",
      "paragraphIndex": 2,
      "contextParagraphIndices": [
        1
      ]
    },
    {
      "target": "61",
      "paragraphIndex": 3
    },
    {
      "target": "65",
      "paragraphIndex": 7
    }
  ],
  "61": [
    {
      "target": "65",
      "paragraphIndex": 24
    },
    {
      "target": "65",
      "paragraphIndex": 28
    }
  ],
  "63": [
    {
      "target": "62",
      "paragraphIndex": 1
    }
  ],
  "72": [
    {
      "target": "66",
      "paragraphIndex": 1,
      "targetPoints": [
        "а"
      ]
    }
  ],
  "74": [
    {
      "target": "62",
      "paragraphIndex": 40
    }
  ],
  "75": [
    {
      "target": "35",
      "paragraphIndex": 9,
      "targetPoints": [
        "а"
      ]
    },
    {
      "target": "36",
      "paragraphIndex": 15
    },
    {
      "target": "35",
      "paragraphIndex": 15
    },
    {
      "target": "14",
      "paragraphIndex": 38
    },
    {
      "target": "81",
      "paragraphIndex": 42
    }
  ],
  "76": [
    {
      "target": "81",
      "paragraphIndex": 17
    },
    {
      "target": "64",
      "paragraphIndex": 24
    }
  ],
  "79": [
    {
      "target": "36",
      "paragraphIndex": 6
    },
    {
      "target": "35",
      "paragraphIndex": 8
    },
    {
      "target": "45",
      "paragraphIndex": 9
    },
    {
      "target": "35",
      "paragraphIndex": 16
    },
    {
      "target": "36",
      "paragraphIndex": 16
    },
    {
      "target": "35",
      "paragraphIndex": 22
    },
    {
      "target": "36",
      "paragraphIndex": 22
    },
    {
      "target": "61",
      "paragraphIndex": 24
    }
  ],
  "80": [
    {
      "target": "81",
      "paragraphIndex": 9
    }
  ],
  "83": [
    {
      "target": "17",
      "paragraphIndex": 5
    },
    {
      "target": "17",
      "paragraphIndex": 6
    }
  ]
};

export type ContextReferenceIndex = {
  paragraphIndex: number;
  groupIds: 'all' | readonly string[];
  reason: string;
};
/** Groups are navigation categories, never inferred numeric normative referrals.
 * 'all' deliberately retains the full catalogue when the source leaves the
 * affected organ or underlying disease unspecified. Narrow groups only reflect
 * organs explicitly named in the paragraph or its own article (skin, article59).
 */
export const CONTEXT_REFERENCE_INDEX: Readonly<Record<string, readonly ContextReferenceIndex[]>> = {
  "1": [
    {
      "paragraphIndex": 0,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "2": [
    {
      "paragraphIndex": 1,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "3": [
    {
      "paragraphIndex": 2,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "4": [
    {
      "paragraphIndex": 7,
      "groupIds": [
        "digestive",
        "neoplasms"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "8": [
    {
      "paragraphIndex": 13,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "10": [
    {
      "paragraphIndex": 39,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "12": [
    {
      "paragraphIndex": 27,
      "groupIds": "all",
      "reason": "Навігація за основним захворюванням"
    }
  ],
  "13": [
    {
      "paragraphIndex": 45,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "20": [
    {
      "paragraphIndex": 6,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "22": [
    {
      "paragraphIndex": 0,
      "groupIds": "all",
      "reason": "Навігація за основним захворюванням"
    }
  ],
  "23": [
    {
      "paragraphIndex": 3,
      "groupIds": "all",
      "reason": "Навігація за основним захворюванням"
    }
  ],
  "25": [
    {
      "paragraphIndex": 18,
      "groupIds": [
        "eye"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "26": [
    {
      "paragraphIndex": 1,
      "groupIds": [
        "eye"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    },
    {
      "paragraphIndex": 19,
      "groupIds": [
        "eye"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "29": [
    {
      "paragraphIndex": 2,
      "groupIds": [
        "nervous",
        "ear"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "38": [
    {
      "paragraphIndex": 85,
      "groupIds": "all",
      "reason": "Навігація за основним захворюванням"
    }
  ],
  "39": [
    {
      "paragraphIndex": 60,
      "groupIds": "all",
      "reason": "Навігація за основним захворюванням"
    }
  ],
  "47": [
    {
      "paragraphIndex": 18,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "53": [
    {
      "paragraphIndex": 19,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "55": [
    {
      "paragraphIndex": 14,
      "groupIds": [
        "digestive"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "59": [
    {
      "paragraphIndex": 1,
      "groupIds": [
        "skin"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "63": [
    {
      "paragraphIndex": 0,
      "groupIds": [
        "neoplasms",
        "circulation"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "66": [
    {
      "paragraphIndex": 70,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "69": [
    {
      "paragraphIndex": 10,
      "groupIds": [
        "neoplasms"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "75": [
    {
      "paragraphIndex": 37,
      "groupIds": [
        "eye",
        "ear",
        "digestive"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "77": [
    {
      "paragraphIndex": 12,
      "groupIds": [
        "circulation",
        "respiratory",
        "digestive"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "78": [
    {
      "paragraphIndex": 18,
      "groupIds": [
        "musculoskeletal",
        "circulation",
        "nervous"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "79": [
    {
      "paragraphIndex": 25,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "80": [
    {
      "paragraphIndex": 8,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "81": [
    {
      "paragraphIndex": 7,
      "groupIds": "all",
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ],
  "86": [
    {
      "paragraphIndex": 2,
      "groupIds": [
        "nervous",
        "genitourinary"
      ],
      "reason": "Навігація за органом, системою або основним захворюванням"
    }
  ]
};
