# Architecture

## Shared presentation

`public/paper.css` owns the paper colours, system font stacks, reusable page elements and print defaults. Pages consume these rules to keep screen and printed materials consistent without a font download or a site build. Page-specific layouts remain with their pages.
