This initial proof-of-concept app demonstrates some key features and usability
ideas for the Tree Illustrator. It will use static files where possible, with
Javascript for behavior, d3 for visualization, and client-side persistence to
manage and store settings.

Here's an easy way to serve this page locally using Python:
```bash
cd stylist/
python -m SimpleHTTPServer 8888
```
Now open a web browser to http://localhost:8888/stylist.html
