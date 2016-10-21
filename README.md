Tree Illustrator
================

[![Join the chat at https://gitter.im/OpenTreeOfLife/tree-illustrator](https://badges.gitter.im/OpenTreeOfLife/tree-illustrator.svg)](https://gitter.im/OpenTreeOfLife/tree-illustrator?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

**Generate repeatable, data-driven, publication quality figures of trees.**

In our current roadmap, the Tree Illustrator will be integrated with the main
[Open Tree](https://github.com/opentreeoflife) apps and docstore, as well as
[Arbor](https://github.com/arborworkflows) workflow tools. This raises many
questions about:

* data visibility and access
* pre- and post-publication use cases
* incentives for participation in Open Tree

Initial work is focused on a
[proof-of-concept](https://github.com/OpenTreeOfLife/tree-illustrator/tree/master/stylist)
web application and on further discussion in the
[wiki](https://github.com/OpenTreeOfLife/tree-illustrator/wiki). 

Our [simple project website](http://opentreeoflife.github.io/tree-illustrator/) is managed with GitHub Pages; by convention, its source can be found [in the `gh-pages` branch of this repository](https://github.com/OpenTreeOfLife/tree-illustrator/tree/gh-pages). 

Bundling the JS with NPM and Browserify
---------------------------------------

Our code incorporates Vega 2, so we've adopted their basic toolchain for bundling most of Tree Illustrator's functionality in CommonJS modules. See [this wiki page for a quick overview](https://github.com/vega/vega/wiki/Vega-and-Browserify) of the build tools required (Node.js, npm, Browserify) and a basic working setup that will watch your source files and attempt bundle them following any saved changes.
