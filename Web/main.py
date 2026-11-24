from flask import Flask, jsonify, render_template, request
import Web.auth.login_routes as login_routes
import mock_data
# Run in terminal
# flask --app Web/main run
app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")

@app.get("/dashboard/fetchData")
def sendData():
    return mock_data.nest_dicts()