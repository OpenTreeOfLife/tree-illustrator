This initial proof-of-concept app demonstrates some key features and usability
ideas for the Tree Illustrator. It will use static files where possible, with
Javascript for behavior, d3 for visualization, and client-side persistence to
manage and store settings.

Here's an easy way to serve this page locally using Python:
```bash
cd tree-illustrator/   # root of this repo
python -m SimpleHTTPServer 8888
```
Now open a web browser to http://localhost:8888/stylist/stylist.html

**Easier still!** We now have a hosted version of the latest work at
http://rawgit.com/OpenTreeOfLife/tree-illustrator/master/stylist/stylist.html

