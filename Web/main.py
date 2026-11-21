from flask import Flask, jsonify, render_template, request
import Web.auth.login_routes as login_routes

# Run in terminal
# flask --app Web/main run
app = Flask(__name__)


@app.get("/login", methods=["GET"])
def index():
    return render_template("index.html")


if __name__ == '__main__':
    app.run(debug=True)