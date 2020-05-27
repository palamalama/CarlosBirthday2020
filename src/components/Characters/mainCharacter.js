import React from "react";
import * as d3 from "d3";

class MainCharacter extends React.Component{
	constructor(props){
		super(props);
	}
	render(){
		return (
			<g ref={(group) => this.group = group}>
				<circle ref={(circle) => this.circle = circle} cx={this.props.center.x+"px"} cy={this.props.center.y+"px"} fill="red" stroke="crimson"/>
				<text x={this.props.center.x+"px"} y={this.props.center.y+"px"} >
					{this.props.me.name}
				</text>	
			</g>
		);
	}
	componentDidUpdate(){
		let radius= Math.sqrt(this.props.me.size*3);
		let strokeWidth = Math.sqrt(this.props.me.size*2);
		let fontSize = Math.sqrt(this.props.me.size)+15;

		let transitionGroup = d3.select(this.group);
//			.transition()
//			.duration(100)
			
		transitionGroup.select("circle")
			.attr("r",radius)
			.attr("stroke-width",strokeWidth);
		transitionGroup.select("text")
			.attr("font-size",fontSize);
	}
}

export default MainCharacter;
