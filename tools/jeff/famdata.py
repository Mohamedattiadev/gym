# (family, video, spoken/chapter second)  -> stored as second-2
CHEST, BACK, SHO, BIS, TRI, QUAD, GLUTE, ALL25, S7 = ("fGm-ef-4PVk", "jLvqKgW-_G8", "SgyUoY0IZ7A", "GNO4OtYoCYk",
    "OpRMRhr0Ycc", "kIXcoivzGf8", "3ryh7PNhz3E", "S6rqpxVGKZ4", "qpRGnTTcLpo")

FAM = [
    # back video (chapters)
    ("assisted-pull-up", BACK, 166), ("barbell-row", BACK, 299), ("bodyweight-row", BACK, 412),
    ("chest-supported-high-elbow-row", BACK, 533), ("chest-supported-row", BACK, 533),
    ("close-grip-pulldown", BACK, 239), ("deadlift", BACK, 100), ("dumbbell-row-bent-over", BACK, 446),
    ("high-elbow-dumbbell-row", BACK, 446), ("lat-pulldown", BACK, 218), ("machine-row", BACK, 533),
    ("meadows-row", BACK, 388), ("one-arm-dumbbell-row", BACK, 446), ("pendlay-row", BACK, 351),
    ("pull-up", BACK, 166), ("seated-cable-high-elbow-row", BACK, 577), ("seated-cable-row", BACK, 562),
    ("single-arm-cable-row", BACK, 562), ("t-bar-row", BACK, 505), ("cable-pullover", BACK, 637),
    ("dumbbell-pullover", BACK, 674), ("face-pull", BACK, 590),
    # chest video
    ("barbell-incline-press", CHEST, 153), ("barbell-pullover", CHEST, 77), ("cable-fly", CHEST, 614),
    ("decline-press", CHEST, 176), ("deficit-push-ups", CHEST, 405), ("dips-chest", CHEST, 308),
    ("dumbbell-fly", CHEST, 692), ("dumbbell-pullover", CHEST, 77), ("flat-dumbbell-press", CHEST, 215),
    ("floor-press", CHEST, 789), ("incline-dumbbell-fly", CHEST, 692), ("incline-dumbbell-press", CHEST, 256),
    ("machine-chest-press", CHEST, 276), ("machine-incline-press", CHEST, 276), ("push-ups", CHEST, 352),
    ("scoop-fly", CHEST, 692), ("smith-incline-press", CHEST, 586), ("triceps-dips", CHEST, 308),
    ("machine-fly", CHEST, 669),
    # shoulders
    ("barbell-overhead-press", SHO, 230), ("cable-lateral-raise", SHO, 477), ("dumbbell-lateral-raise", SHO, 100),
    ("dumbbell-shoulder-press", SHO, 325), ("face-pull", SHO, 661), ("machine-lateral-raise", SHO, 426),
    ("machine-rear-delt-fly", SHO, 626), ("machine-shoulder-press", SHO, 349), ("rear-delt-cable-fly", SHO, 718),
    ("rear-delt-raise", SHO, 696), ("upright-row", SHO, 595), ("y-raise", SHO, 533), ("front-raise", SHO, 405), ("incline-lateral-raise", SHO, 382),
    # biceps
    ("barbell-curl", BIS, 116), ("behind-body-cable-curl", BIS, 628), ("cable-curl", BIS, 612),
    ("drag-curl", BIS, 455), ("dumbbell-curl", BIS, 217), ("hammer-curl", BIS, 786),
    ("incline-dumbbell-curl", BIS, 320), ("machine-curl", BIS, 421), ("preacher-curl", BIS, 265),
    ("spider-curl", BIS, 491),
    # triceps
    ("bar-pushdown", TRI, 129), ("rope-pushdown", TRI, 60), ("bench-dips", TRI, 680), ("cable-kickback", TRI, 545),
    ("cable-overhead-extension", TRI, 193), ("close-grip-press", TRI, 728), ("dead-skulls", TRI, 410),
    ("dumbbell-skull-crushers", TRI, 453), ("french-press", TRI, 348), ("jm-press", TRI, 478),
    ("kickback", TRI, 600), ("single-arm-overhead-extension", TRI, 390), ("skull-crushers", TRI, 410),
    ("triceps-push-ups", TRI, 779), ("triceps-dips", TRI, 645), ("machine-dips", TRI, 705),
    # quads
    ("bulgarian-split-squat", QUAD, 574), ("front-squat", QUAD, 184), ("hack-squat", QUAD, 276),
    ("high-bar-squat", QUAD, 121), ("leg-press", QUAD, 350), ("low-bar-squat", QUAD, 248),
    ("single-leg-squat", QUAD, 640), ("sissy-squat", QUAD, 656), ("smith-squat", QUAD, 325),
    ("step-up", QUAD, 624), ("leg-extension", QUAD, 425), ("deadlift", QUAD, 603),
    # glutes
    ("hip-abduction", GLUTE, 500), ("hip-thrust", GLUTE, 126), ("reverse-lunge", GLUTE, 565),
    ("split-squat", GLUTE, 612), ("walking-lunge", GLUTE, 565), ("bulgarian-split-squat", GLUTE, 376),
    ("high-bar-squat", GLUTE, 325), ("smith-squat", GLUTE, 368), ("step-up", GLUTE, 475),
    ("deadlift", GLUTE, 651), ("sumo-deadlift", GLUTE, 679), ("romanian-deadlift", GLUTE, 701),
    ("back-extension", GLUTE, 728), ("glute-hyper", GLUTE, 728),
    # only 25 (spoken moments)
    ("standing-calf-raise", ALL25, 99), ("leg-press-calf-raise", ALL25, 99), ("seated-calf-raise", ALL25, 109),
    ("cable-crunch", ALL25, 230), ("machine-rear-delt-fly", ALL25, 307), ("dips-chest", ALL25, 340),
    ("hip-thrust", ALL25, 374), ("behind-body-cable-curl", ALL25, 406), ("deadlift", ALL25, 444),
    ("barbell-overhead-press", ALL25, 505), ("walking-lunge", ALL25, 543), ("seated-leg-curl", ALL25, 791),
    ("lying-leg-curl", ALL25, 811), ("leg-extension", ALL25, 819), ("cable-overhead-extension", ALL25, 872),
    ("preacher-curl", ALL25, 905), ("dumbbell-lateral-raise", ALL25, 947), ("chest-supported-row", ALL25, 1012),
    ("romanian-deadlift", ALL25, 1060), ("glute-rdl", ALL25, 1060), ("barbell-incline-press", ALL25, 1109),
    ("pull-up", ALL25, 1172), ("high-bar-squat", ALL25, 1252), ("shrug", ALL25, 73),
    ("wrist-curl", ALL25, 124), ("wrist-extension", ALL25, 124),
    # 7 S-tier
    ("dead-hang", S7, 39), ("hammer-curl", S7, 184), ("y-raise", S7, 297), ("machine-rear-delt-fly", S7, 397),
    ("mid-trap-shrug", S7, 672),
]

JN, RP, JE, SU = "Jeff Nippard", "Renaissance Periodization", "Jeremy Ethier", "Squat University"
VID = {
    CHEST: (JN, "The Best And Worst Chest Exercises (Ranked By Science)"),
    SHO: (JN, "The Best And Worst Shoulder Exercises"),
    BIS: (JN, "The Best And Worst Biceps Exercises"),
    TRI: (JN, "The Best & Worst TRICEPS Exercises (Ranked Using Science)"),
    GLUTE: (JN, "The Best & Worst Glute Exercises (According To Science)"),
    ALL25: (JN, "The Only 25 Exercises You Ever Need"),
    S7: (JN, "7 Amazing Exercises No One Does (ALL S TIER)"),
    "C6sYjDFuq9I": (JN, "How To Build Bigger Traps: Optimal Training Explained"),
    "MfMxT_jXcPE": (JN, "How To Build Huge Forearms: Optimal Training Explained (5 Best Exercises!)"),
    "1G0y8D5rFDc": (JN, "How To Build A Better Core & Six Pack Abs: Optimal Training Explained"),
    "_P4jqZf_rFk": (SU, "Heavy Jefferson Curls (STOP DOING THESE)"),
    "5z7ZtboxbBY": (RP, "Dumbbell Bent Shrug"),
    "zgToz5FiI-E": (RP, "Seated Dumbbell Shrug"),
    "L9oMEzzQ9og": (RP, "The Secret to Truly Huge Arms (Grow Your Forearms)"),
    "P7yDTqe3xnw": (JE, "How To Get Bigger Forearms FAST (3 Science-Based Tips)"),
    "21inrjhoFkQ": (JN, "The Most Scientific Way to Train CALVES (Science Explained)"),
    "WVAaKJvToe0": (RP, "Cable Wrist Curl"),
}
EX = [
    # triceps
    ("cable-straight-bar-curl-copy", TRI, 728), ("close-grip-smith-elbows-out", TRI, 728),
    ("close-grip-tricep-press", TRI, 728), ("close-grip-tricep-press-elbows-flared", TRI, 728),
    ("close-grip-tricep-press-elbows-tucked", TRI, 728),
    ("smith-tricep-neck-crushers", TRI, 529),
    ("v-handle-tricep-extensions-elbows-tucked", TRI, 129),
    ("cable-rope-french-press-copy", TRI, 60), ("cable-kickbacks-copy", TRI, 60),
    ("rope-extensions-elbows-flared-frontal-plane", TRI, 60), ("rope-extensions-elbows-tucked-sagittal-plane", TRI, 60),
    # calves (standing straight-leg)
    *[(s, ALL25, 99) for s in ["barbell-calf-raise-ryan_humis514743", "barbell-calf-raise-extreme-stretch",
        "plate-calf-raises-toes-straight-garage-program"]],
    *[(s, "21inrjhoFkQ", 392) for s in ["plate-calf-raises-toes-turned-in-garage-program",
        "plate-calf-raises-toes-turned-out-garage-program", "single-leg-dumbbell-calf-raise-toe-in",
        "single-leg-dumbbell-calf-raise-toe-in-ryan_humis514743", "single-leg-dumbbell-calf-raise-toe-out",
        "single-leg-dumbbell-calf-raise-toe-out-ryan_humis514743"]],
    *[(s, "21inrjhoFkQ", 365) for s in ["single-leg-dumbbell-calf-raise-ryan_humis514743",
        "single-leg-dumbbell-calf-raise-neutral", "single-leg-dumbbell-calf-raise-toes-straight"]],
    # hinge / lower back
    ("smith-rdls", ALL25, 1060), ("split-stance-dumbbell-glute-stiff-copy-ryan_humis514743", GLUTE, 679),
    *[(s, GLUTE, 728) for s in ["hyper-extensions-ryan_humis514743", "deadlifts-copy", "hyper-extensions-weighted",
        "weighted-walking-lunges-heavy-copy-ryan_humis514743", "poor-mans-hyper-extension",
        "single-leg-hyper-extensions-weighted", "weighted-straight-hyper-drop-start-copy",
        "weighted-straight-hyper-drop-start", "smith-dumbbell-stiff-leg-copy", "glute-hyper-weighted",
        "leg-press-calf-raise-single-clusterfuck-copy"]],
    ("jeffersons", "_P4jqZf_rFk", 27),
    # traps
    ("dead-hang-ryan_humis514743", S7, 39),
    *[(s, S7, 672) for s in ["1-arm-dumbbell-kelso-shrug", "barbell-bent-over-mid-trap-shrugs",
        "landmine-mid-trap-shrugs", "smith-bent-over-mid-trap-shrugs"]],
    *[(s, ALL25, 73) for s in ["dumbbell-shrug-extreme-stretch", "dumbbell-shrug-mechanical-drop-starting-form-copy",
        "barbell-row-mechanical-drop-end-form-copy", "dead-pull-ups-copy", "standing-dumbbell-shrugs-ryan_humis514743"]],
    *[(s, "C6sYjDFuq9I", 94) for s in ["barbell-shrug-drops-garage-program", "barbell-shrugs-wide-grip-garage-2-0",
        "dumbbell-shrugs-copy"]],
    ("incline-dumbbell-high-elbow-row-copy", "C6sYjDFuq9I", 311),
    ("pendlay-row-copy", "zgToz5FiI-E", 0),
    ("bent-dumbbell-shrugs", "5z7ZtboxbBY", 0), ("slightly-bent-dumbbell-shrugs", "5z7ZtboxbBY", 0),
    # forearms
    ("seated-dumbbell-wrist-extensions", ALL25, 124),
    ("barbell-wrist-curls-ryan_humis514743", "L9oMEzzQ9og", 143),
    *[(x, "P7yDTqe3xnw", 383) for x in ["dumbbell-pronators", "lying-dumbbell-pronation", "dumbbell-supinators"]],
    ("dual-single-handle-wrist-curl", "WVAaKJvToe0", 0),
    ("ez-bar-reverse-grip-curls-ryan_humis514743", "MfMxT_jXcPE", 74),
    # abs
    ("diy-barbell-ab-roller", "1G0y8D5rFDc", 309), ("poor-mans-ab-roller-garage-program", "1G0y8D5rFDc", 309),
    # chest / shoulders / biceps
    *[(s, CHEST, 669) for s in ["machine-fly-extreme-stretch", "smith-incline-pause-press-copy",
        "slight-incline-dumbbell-press-clusterfuck-copy", "smith-incline-pause-press-copy-ryan_humis514743"]],
    ("incline-fly-triset-garage-program", CHEST, 692),
    ("machine-single-arm-rear-delt-fly-copy-f3f2bf18-674c-43af-9f13-4fcf47830306", SHO, 458),
    ("plate-supinated-raise-garage-2-0", SHO, 405),
    ("alternating-curls-giant-set-garage-program", BIS, 217), ("supinated-dumbbell-elbows-tucked-close-grip", BIS, 217),
]
