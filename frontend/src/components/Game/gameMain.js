import React from "react";
import ReactDOM from 'react-dom';
import * as d3 from "d3";


class Game extends React.Component {
	constructor(props){
		super(props);
		this.updateMousePosition = this.updateMousePosition.bind(this);
		this.state = {
			people:[...new Array(10)].map(() => { return {"name":"random boy","size":10,"x":Math.random()*this.props.mapSize.x,"y":Math.random()*this.props.mapSize.y}}),
			food:[],
			me:{"x":Math.random()*props.mapSize.x,"y":Math.random()*props.mapSize.y,"name":props.name,"size":10}
		}
		console.log("Setting state is all good");
		
	}
	render(){
		return (
			<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
				<circle ref={(center) => this.centerOfScreenElement = center} cx="50%" cy="50%" r="0" />
			</svg>
		);
	}

	draw(){
		this.drawPeople();
	}
	drawPeople(){
		let people = d3.select(this.svg)
			.selectAll(".people")
			.data(this.state.people);

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
			.attr("cx",(d) => (d.x-this.state.me.x)+"%")
			.attr("cy",(d) => (d.y-this.state.me.y)+"%")
			.attr("stroke-width",(d) => Math.sqrt(d.size*2))
			.attr("r", (d) => d.size);
		transition.select("text")
			.attr("x", (d) => (d.x-this.state.me.x)+"%")
			.attr("y", (d) => (d.y-this.state.me.y)+"%")
			.attr("font-size", (d) => Math.sqrt(d.size*2+200));
		let meData = [];
		meData.push(this.state.me);
		let me = d3.select(this.svg)
			.selectAll(".me")
			.data(meData);
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
		me.exit().remove();
		
		let transitionMe = me.transition()
			.duration(100);
		transitionMe.select("circle")
			.attr("stroke-width",(d) => Math.sqrt(d.size*2)) 
			.attr("font-size", (d) => Math.sqrt(d.size*2+200))
			.attr("r",(d) => d.size);
		transitionMe.select("text")
			.attr("font-size",(d) => Math.sqrt(d.size*2+200));
			
	}

	componentDidMount() {
		this.loadDataInterval = setInterval(() => this.loadData(), 50);
		this.draw();
	}
	componentDidUpdate(){
		this.draw();
	}
	componentWillUnmount() {
		clearInterval(this.loadDataInterval);
	}
	loadData(){
		let newState = this.state;
		newState.people.forEach((_,i,people) => {
			people[i].x += Math.random()-0.5;
			people[i].y += Math.random()-0.5;
			people[i].size += Math.random()*0.01;
		});
		for(let i = 0; i<1; i++){
			newState.food.push({"x":Math.random()* this.props.mapSize.x,"y":Math.random()*this.props.mapSize.y});
		}
		let dx = 0;
		let dy = 0;
		if(this.mousePosition){
			console.log("Not undefined");
			dx = (this.mousePosition.x - screen.width /2)/100;
			dy = (this.mousePosition.y - screen.height /2)/100;
		}
		let length = Math.sqrt(dx*dx + dy*dy);
		newState.me.x += dx/(0.001+length)*Math.min(length,1);	
		newState.me.y += dy/(0.001+length)*Math.min(length,1);
		this.setState(newState);
	}
	updateMousePosition(e){
		this.mousePosition = {x:e.screenX,y:e.screenY};
	}
}
export default Game;
