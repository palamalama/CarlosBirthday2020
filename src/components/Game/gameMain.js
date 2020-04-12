import React from "react";
import * as d3 from "d3";
import openSocket from 'socket.io-client';

class Game extends React.Component {
	constructor(props){
		super(props);
		this.updateMousePosition = this.updateMousePosition.bind(this);
		this.state = {
			people:{},
			me:{}
		}
		
	}
	render(){
		return (
			<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
				<circle ref={(center) => this.centerOfScreenElement = center} cx="50%" cy="50%" r="1" />
			</svg>
		);
	}

	draw(){
		this.drawLines();
		this.drawPeople();
	}
	drawLines(){
	}
	drawPeople(){
		console.log(this.state.people);
		let people = d3.select(this.svg)
			.selectAll(".people")
			.data(Object.values(this.state.people));

		let newGroup = people.enter()
			.append("g")
			.attr("class","people");
		newGroup.append("circle")
			.attr("stroke","crimson")
			.attr("fill","red");

		newGroup.append("text")
			.text((d) => d.name);

		people.exit().remove();
		
		let transition = people.transition()
			.duration(100)
		transition.select("circle")
			.attr("cx",(d) => (d.x-this.state.me.x)+this.centerCoordinates.x)
			.attr("cy",(d) => (d.y-this.state.me.y)+this.centerCoordinates.y)
			.attr("stroke-width",(d) => Math.sqrt(d.size*2))
			.attr("r", (d) => d.size);
		transition.select("text")
			.attr("x", (d) => (d.x-this.state.me.x)+this.centerCoordinates.x)
			.attr("y", (d) => (d.y-this.state.me.y)+this.centerCoordinates.y)
			.text((d) => d.name)
			.attr("font-size", (d) => Math.sqrt(d.size*2+200));

		let meData = [];
		meData.push(this.state.me);
		let me = d3.select(this.svg)
			.selectAll(".me")
			.data(meData);
		me.exit().remove();
		let newMe = me.enter()
			.append("g")
			.attr("class","me");
		newMe.append("circle")
			.attr("cx","50%")
			.attr("cy","50%")
			.attr("stroke","crimson")
			.attr("fill","red");
		newMe.append("text")
			.attr("x","50%")
			.attr("y","50%")
			.text((d) => d.name);
		
		let transitionMe = me.transition()
			.duration(100);
		transitionMe.select("circle")
			.attr("stroke-width",(d) => Math.sqrt(d.size*2)) 
			.attr("font-size", (d) => Math.sqrt(d.size*2+200))
			.attr("r",(d) => d.size);
		transitionMe.select("text")
			.text((d) => d.name)
			.attr("font-size",(d) => Math.sqrt(d.size*2+200));
			
	}

	componentDidMount() {
		this.socket = openSocket();
		this.socket.on("setup",(response) => {
			let people = response.data.people;
			let me = people[response.new_user_id];
			me.name = this.props.name;
			delete people[response.new_user_id];
			this.setState({
				people:people,
				me:me
			});
		});
		this.socket.on("update",(data) => {
			let people = data.people;
			delete people[this.state.me.id];
			this.setState({
				people:people
			});
		});
		this.updatePosition();
		this.updatePositionInterval = setInterval(() => this.updatePosition(), 50);
		this.draw();
	}
	componentDidUpdate(){
		this.draw();
	}
	componentWillUnmount() {
		clearInterval(this.updatePositionInterval);
	}
	updatePosition(){
		let rect = this.centerOfScreenElement.getBoundingClientRect();
		this.centerCoordinates = {x:rect.x,y:rect.y};
		let newState = this.state;
		let dx = 0;
		let dy = 0;
		if(this.mousePosition){
			dx = (this.mousePosition.x - this.centerCoordinates.x);
			dy = (this.mousePosition.y - this.centerCoordinates.y);
		}
		let length = Math.max(0.001,Math.sqrt(dx*dx + dy*dy)-200);
		newState.me.x += dx/length*Math.min(length/100,1);	
		newState.me.y += dy/length*Math.min(length/100,1);
		this.setState(newState);
		this.socket.emit("update",this.state.me);
	}
	updateMousePosition(e){
		this.mousePosition = {x:e.clientX,y:e.clientY};
	}
}
export default Game;
