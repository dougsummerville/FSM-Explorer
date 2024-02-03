"use strict";
/*Editor*/
var fsmNodes= [];
var fsmArcs= [];
var fsmSelfArcs= [];
var fsmResetArcs= [];
var tool= "";
var temporaryObject= null;
var selectedObject= null;
var selectionOffset= null;
var subjectOfModal= null;
var selectionBox= null;
var changeHistory= null;
var nodeRadius= 0;
var fsmCanvas=null;
var fsmC2D=null;
var debug=null;
var historyExcludeMultiple=["node size","font size"];
var currentMode= "";
var multiSelect= false;
var waveforms=null;
/*Simulator*/
var simCanvas=null;
class history{
	constructor(m,r,exclude){
		this.states=new Array();
		this.index=-1;
		this.makeBackup=m;
		this.restoreBackup=r;
		this.reason="";
	}
	push(reason=""){
		const back=this.makeBackup();
		if( reason === "" || reason != this.reason || !historyExcludeMultiple.includes(reason))
		{
			this.index=this.index+1;
		}
		this.states.length=this.index; 
		this.states.push(back);
		this.reason=reason;
		return this.current;
	}
	undo(){
		if( this.index > 0){
			this.index=this.index-1;
			this.restore();
		}
		this.reason="";
		return this.current;
	}
	redo(){
		if( this.states.length > this.index+1){
			this.index=this.index+1;
			this.restore();
			this.reason="";
		}
		return this.current;
	}
	restore(){
		if( this.index >= 0 )
			this.restoreBackup(this.current);
		return this.current; 
	}
	get current(){
		return this.states[this.index];
	}
}
class myButton{
	constructor(divId,btnId,classType,text,title="",onclk=null){
		let div= document.getElementById(divId);
		this.btn = document.createElement("button");
		this.btn.className=classType;
		this.btn.id=btnId;
		this.btn.innerText = text;
		this.btn.addEventListener("click",onclk);
		this.btn.title=title;
		div.appendChild(this.btn);
	}
}
CanvasRenderingContext2D.prototype.moveToPoint=function(p){
	this.moveTo(p.x,p.y);
}
CanvasRenderingContext2D.prototype.lineToPoint=function(p){
	this.lineTo(p.x,p.y);
}
CanvasRenderingContext2D.prototype.quadraticCurveToPoint=function(p1,p2){
	this.quadraticCurveTo(p1.x,p1.y,p2.x,p2.y);
}
CanvasRenderingContext2D.prototype.translateToPoint=function(p1){
	this.translate(p1.x,p1.y);
}
CanvasRenderingContext2D.prototype.arcAtCenter=function(p1,r,as,ae,p){
	this.arc(p1.x,p1.y,r,as,ae,p);
}
CanvasRenderingContext2D.prototype.fillTextAtPoint=function(t,p){
	this.fillText(t,p.x,p.y);
}
CanvasRenderingContext2D.prototype.fillTextAtVector=function(t,v,padding=0){
	let octant= Math.round(4*v.angle()/Math.PI);
	switch(octant ){
		case 0:
			this.textAlign="left";
			this.textBaseline="middle";
			break;
		case 1:
			this.textAlign="left";
			this.textBaseline="top";
			break;
		case 2:
			this.textAlign="middle";
			this.textBaseline="top";
			break;
		case 3:
			this.textAlign="right";
			this.textBaseline="top";
			break;
		case 4:
		case -4:
			this.textAlign="right";
			this.textBaseline="middle";
			break;
		case -3:
			this.textAlign="right";
			this.textBaseline="bottom";
			break;
		case -2:
			this.textAlign="center";
			this.textBaseline="bottom";
			break;
		default:
			this.textAlign="left";
			this.textBaseline="bottom";
	}
	this.fillTextAtPoint(t,v.normalize(v.length()+padding).to);
}
CanvasRenderingContext2D.prototype.fillTriangle=function(x1,y1,x2,y2,x3,y3){
	this.beginPath();
	this.moveTo(x1,y1)
	this.lineTo(x2,y2)
	this.lineTo(x3,y3)
	this.fill();
}
CanvasRenderingContext2D.prototype.arrowAtVector=function(v,s,reverse=false, offset=0){
	this.save();
	this.beginPath();
	this.translateToPoint(v.to);
	this.rotate(v.angle() +offset + (reverse ? Math.PI:0));
	this.moveTo(0,0);
	this.lineTo(s,s);
	this.lineTo(s,-s);
	this.fill();
	this.restore();
}
class boundingBox{
	constructor(points,pad=0){
		({start:this.start,end:this.end}=boundingBox.findBounds(points,pad));
	}
	contains(p){
		let upLeft=new point( Math.min(this.start.x,this.end.x),Math.min(this.end.y,this.start.y));
		let lowRight=new point( Math.max(this.start.x,this.end.x),Math.max(this.end.y,this.start.y));
		return p.x>=upLeft.x && p.y >= upLeft.y && p.x <=lowRight.x && p.y <= lowRight.y;
	}
	static findBounds(points,pad=0){
		let allx=points.map(p=>p.x);
		let ally=points.map(p=>p.y);
		return {
			start:new point(Math.min(...allx)-pad, Math.min(...ally)-pad),
			end:new point(Math.max(...allx)+pad, Math.max(...ally)+pad)
		};
	}
	centerPoint(){
		let upLeft=new point( Math.min(this.start.x,this.end.x),Math.min(this.end.y,this.start.y));
		let lowRight=new point( Math.max(this.start.x,this.end.x),Math.max(this.end.y,this.start.y));
		return upLeft.plus({x:this.width/2,y:this.height/2});
	}
	get height(){
		return Math.abs(this.start.y-this.end.y);
	}
	get width(){
		return Math.abs(this.start.x-this.end.x);
	}
	relativeCoordinatesOfPoint(p){
		return new point((p.x-this.start.x)/this.width, (p.y-this.start.y)/this.height);
	}
}
function locateObjectAt(p) {
	for (node of fsmNodes) {
		if( node.containsPoint(p) )
			return node;
	}
	for (arc of fsmArcs) {
		if( arc.containsPoint(p) )
			return arc;
	}
	for (arc of fsmSelfArcs) {
		if( arc.containsPoint(p) )
			return arc;
	}
	for (arc of fsmResetArcs) {
		if( arc.containsPoint(p) )
			return arc;
	}
	return new fsmElement();
}
function getMousePosition(canvas, evt) {
  let rect = canvas.getBoundingClientRect();
  let ctx=canvas.getContext('2d');
  let scale=ctx.getTransform();
  let vscale= canvas.height/scale.d/rect.height;
  let hscale= canvas.width/scale.a/rect.width;
  return new point( hscale*(evt.clientX - rect.left), vscale*(evt.clientY - rect.top));
}

class point{
	constructor(){
		switch(arguments.length){
			case 0:
				this.x=0;
				this.y=0;
				break;
			case 1:
				this.x=arguments[0].x;
				this.y=arguments[0].y;
				break;
			default:
				this.x=arguments[0];
				this.y=arguments[1];
		}
	}
	toString(){return this.x.toString()+','+this.y.toString();}
	plus(p){
		return new point( this.x+p.x, this.y+p.y);
	}
	minus(p){
		return new point( this.x-p.x, this.y-p.y);
	}
	divideBy(a){
		return new point( this.x/a, this.y/a);
	}
	multiplyBy(a){
		return new point( this.x*a, this.y*a);
	}
	backup(){
		return {'x': this.x, 'y': this.y};
	}
}
const zeroPoint=new point(0,0);
class vector{
	constructor(){
		switch(arguments.length){
		case 2: //two points
			this.from=new point(arguments[0]);
			this.to=new point(arguments[1]);
			break;
		case 1: //a vector or a point (0,p)
			if( Object.hasOwn(arguments[0],"to" )){
				this.to=new point(arguments[0].to);
				this.from=new point(arguments[0].from);
			}else{
				this.to=new point(arguments[0]);
				this.from=new point();
			}
			break;
		default:
			this.from=new point();
			this.to=new point();
		}
	}
	angle(){
		const dx=this.to.x-this.from.x;
		const dy=this.to.y-this.from.y;
		var ret= Math.atan2(dy,dx);
		return ret;
	}
	midpoint(t=0.5){
		return new point( this.from.x+(this.to.x-this.from.x)*t, this.from.y+(this.to.y-this.from.y)*t);
	}
	length(){
		return distance(this.from, this.to);
	}
	add(v){
		this.to.x = this.to.x + (v.to.x-v.from.x);
		this.to.y = this.to.y + (v.to.y-v.from.y);
	}
	translateTo(p){
		return new vector( p,p.plus(this.to.minus(this.from)));
	}
	translateFrom(p){
		return new vector( p.minus(this.to.minus(this.from)),p);
	}
	unit(){ 
		var ret=this.translateTo(new point());
		ret.to.x = ret.to.x/this.length();
		ret.to.y = ret.to.y/this.length();
		return ret;
	}
	normalize(a=1){
		return this.unit().scale(a).translateTo(this.from);
	}
	rotate(a){
		var ret=new vector(this); 
		var vec=this.translateTo(new point()); 
		ret.to.x = this.from.x + Math.cos(a)*vec.to.x-Math.sin(a)*vec.to.y;
		ret.to.y = this.from.y + Math.sin(a)*vec.to.x+Math.cos(a)*vec.to.y;
		return ret;
	}
	dot(v){
		return (this.to.x-this.from.x)*(v.to.x-v.from.x)+(this.to.y-this.from.y)*(v.to.y-v.from.y);
	}
	scale(a){
		return new vector(this.from, this.midpoint(a));
	}	
	backup(){
		return { 'from': this.from.backup(), 'to': this.to.backup() };
	}
}

function distance(a,b){
	return Math.hypot(a.x-b.x,a.y-b.y);
}
function Bezier(P0,P1,P2,t){
	return new point( (1-t)*(1-t)*P0.x+2*(1-t)*t*P1.x+t*t*(P2.x), (1-t)*(1-t)*P0.y+2*(1-t)*t*P1.y+t*t*(P2.y));
}

class fsmElement{
	constructor(ref={from:{x:0,y:0},to:{x:0,y:0}}){
		this.location= new vector(ref);
		this.selected= 'f';
		this.fsmType="none";
		this.fsmSubtype="none";
	}
	set referencePoint(p){
		this.location.to=new point(p);
	}
	get referencePoint(){
		return this.location.to;
	}
	select(){
		this.selected='t';
	}
	deselect(){
		this.selected='f';
	}
	setSelected(c){
		this.selected=c;
	}
	isSelected(){
		return this.selected !='f';
	}
}
class temporaryArc extends fsmElement{
	constructor({n=null,p=null}={}){
		var startPoint= (n!==null)?n.referencePoint: p;
		super(new vector(startPoint,p));
		this.startPoint=startPoint;
		this.node = n;
		this.fsmType="arc";
		this.fsmSubtype="temporary";
		this.referencePoint=p;
	}
	draw(c) {
		c.fillStyle= c.strokeStyle='blue';
		c.beginPath();
		let v=new vector(this.startPoint,this.referencePoint);
		c.moveToPoint(v.from);
		c.lineToPoint(v.to);
		c.stroke();
		c.arrowAtVector(v,nodeRadius/5,true);
	};
}
class selectionRectangle extends boundingBox{
	constructor(start,end){
		super([start,end]);
	}
	draw(c) {
		c.strokeStyle='blue';
		c.beginPath();
		let pa=Math.min(this.start.x, this.end.x);
		let pb=Math.min(this.start.y,this.end.y);
		let pc=Math.abs(this.start.x-this.end.x);
		let pd=Math.abs(this.start.y-this.end.y);
		c.rect(pa,pb,pc,pd);
		c.stroke();
	};
}
class fsmArc extends fsmElement{
	constructor(from,to,pt=null){
		super();
		this.startNode=from;
		this.endNode=to;
		if( pt === null ) {
			let v1=new vector(this.startNode.referencePoint,this.endNode.referencePoint);
			pt=v1.normalize(nodeRadius/2).translateTo(v1.midpoint()).rotate(-Math.PI/2).to;
		}
		this.referencePoint=pt;
		this.updateCurve();
		this.inputText="";
		this.outputText="";
		this.fsmType="arc";
	}
	backup(){
		return {
			'startNode': fsmNodes.indexOf(this.startNode),
			'endNode': fsmNodes.indexOf(this.endNode),
			'inputText': this.inputText,
			'outputText': this.outputText,
			'referencePoint': this.referencePoint.backup(),
			'selected': this.selected
		};
	}
	static from(p){
		let retval = new fsmArc( fsmNodes[p.startNode], fsmNodes[p.endNode], p.referencePoint);
		retval.updateCurve();
		retval.inputText=p.inputText;
		retval.outputText=p.outputText;
		retval.selected=p.selected;
		return retval;
	}
	updateCurve(){
		this.curve=new Array();
		if( this.startNode != this.endNode ){
			for( var t=0; t<=1; t=t+1/1000)
			{
				let pc=this.location.scale(2).to;
				var pt=Bezier(this.startNode.referencePoint,pc,this.endNode.referencePoint,t);
				if( !( this.startNode.containsPoint(pt) || this.endNode.containsPoint(pt) ))
						this.curve.push( pt );
			}
		}else{
			let v1=new vector(this.startNode.referencePoint, this.referencePoint);
			v1=v1.normalize(v1.length()-nodeRadius+5);
			let v2=v1.scale(.5).translateFrom(this.referencePoint).rotate(Math.PI);
			for( var t=0; t<=1000; t=t+1)
			{
				if( !this.startNode.containsPoint(v2.to))
					this.curve.push( v2.to );
				v2=v2.rotate(2*Math.PI/1000);
			}
		}
	}
	draw(c){
		if( this.curve.length < 5  )//Arc is too short to bother decorating
			return;
		c.fillStyle=c.strokeStyle= this.isSelected()?'blue':'black';
		c.beginPath();
		c.moveToPoint(this.curve[0]);
		this.curve.forEach( p=> {c.lineToPoint(p);});
		c.stroke();
 		/*Decorate with Arrow and text*/
		var normal=new vector(this.curve[this.curve.length-2],this.curve[this.curve.length-1]);
		c.arrowAtVector(normal,nodeRadius/5,true);
		c.textAlign="center";
		c.textBaseline="middle";
		let text=this.inputText;
		if( this.outputText) 
			text=text+' / '+this.outputText ;
		c.fillTextAtVector(text,this.location,10);
	};
	set referencePoint(p){
		let vec1=new vector(this.startNode.referencePoint, this.endNode.referencePoint); 
		let vec2=vec1.unit().rotate(Math.PI/2).translateTo(vec1.midpoint());
		vec2=vec2.scale(vec2.dot(new vector(vec1.midpoint(), p)));
		this.location=vec2;
		this.updateCurve();
	}
	get referencePoint(){
		return this.location.to;
	}
	updateLocation(){
		let vec1=new vector(this.startNode.referencePoint, this.endNode.referencePoint); 
		this.location=this.location.rotate(-Math.asin(this.location.unit().dot(vec1.unit())));
		this.referencePoint=this.location.translateTo(vec1.midpoint()).to;
		this.updateCurve();
	}
	containsPoint(pt) {
		if( !new boundingBox([this.startNode.referencePoint, this.endNode.referencePoint,this.referencePoint],5).contains(pt))
			return false;
		if( undefined===this.curve.find(p => { return distance(pt,p) < 5; }))
			return false;
		return true;
	}
};

class fsmResetArc extends fsmElement{
	constructor(ta,node,input="reset",output=""){
		super();
		this.node=node;
		this.referencePoint=ta.startPoint;
		this.inputText=input;
		this.fsmType="arc";
		this.fsmSubtype="reset";
	}
	backup(){
		return {
			'node': fsmNodes.indexOf(this.node),
			'inputText': this.inputText,
			'referencePoint': this.referencePoint.backup(),
			'selected': this.selected
		};
	}
	static from(p){
		let retval= new fsmResetArc( new temporaryArc({n:null,p:p.referencePoint}),fsmNodes[p.node]);
		retval.inputText= p.inputText;
		retval.selected=p.selected;
		return retval;
	}
	draw(c){
		c.fillStyle=c.strokeStyle= this.isSelected() ?'blue':'black';
		c.beginPath();
		c.moveToPoint(this.location.from);
		c.lineToPoint(this.location.to);
		c.stroke();
		c.arrowAtVector(this.location.normalize(-1),nodeRadius/5,true);
		//text
		c.fillTextAtVector(this.inputText,this.location,10);
	}
	containsPoint(pt) {
		//if point distance to endpoints of arc ~ length of arc
		let v1=new vector(this.location.from,pt);
		let v2=new vector(this.location.to,pt);
		
		if(v1.length()+v2.length() <= this.location.length()+5)
			return true;
		else
			return false;
	}
	get referencePoint(){
		return this.location.to;
	}
	set referencePoint(p){
		let v=new vector(this.node.referencePoint,p).normalize(nodeRadius);
		v=v.translateTo(v.to);
		this.location=v;
	}
	updateLocation(){
		this.location=this.location.translateTo(this.node.referencePoint).normalize(nodeRadius);
		this.location=this.location.translateTo(this.location.to);
	}
};
class booleanExpression{
	constructor(expr,literals){			
		this.expr=expr;
		this.literals=literals;
		this.minterms=minterms;
	}
	minterms(literals){
		let s=new Set();
		for( let i=0; i<2**literals.length; i++ ){
			let m=this.evaluate(literals,i.toString(2).padStart(literals.length,'0').split(''));
			if( m === "U" )
				return null;
			else if( m=== "1" )
				s.add(i);
		}
		return s;
	}
	evaluate(literals,values){
		let e=this.expr;
		let ordered=literals.toSorted().reverse();
		for( let l of ordered){
			e=e.replaceAll(l,values[literals.indexOf(l)]);
		}
		let e_last;
		e = e.replace(/[\*&\.]+/g, ""); //Drop AND-like symbols
		e = e.replace(/\s*/g,""); //remove whitespace
		do{
			e_last=e.slice();
			if (e.length < 2 ) break;
			e=e.replace(/!0|0'/g,"1");
			e=e.replace(/!1|1'/g,"0");
			e = e.replace(/(?:^|\()(?:0\+)*1(?:\+[01])*(?:$|\))/g, "1");
			e = e.replace(/(?:^|\()0(?:\+0)*(?:$|\))/g, "0");
			e = e.replace(/(?:^|\()[01]*0[01]*(?:$|\))/g,"0");
			e = e.replace(/(?:^|\()1+(?:$|\))/g,"1");
		}while( e_last !== e);
		if( e === "0" || e === "1" )
			return e;
		else
			return 'U';
	}
	
}
class fsmSelfArc extends fsmElement{
	constructor(ta,input="",output=""){
		super();
		this.node=ta.node;
		this.referencePoint=new point(ta.referencePoint);
		this.inputText=input;
		this.outputText=output;
		this.fsmType="arc";
	}
	backup(){
		return {
			'node': fsmNodes.indexOf(this.node),
			'inputText': this.inputText,
			'outputText': this.outputText,
			'referencePoint': this.referencePoint.backup(),
			'selected': this.selected
		};
	}
	static from(p){
		let retval= new fsmSelfArc( new temporaryArc({n:fsmNodes[p.node],p:p.referencePoint}));
		retval.inputText= p.inputText;
		retval.outputText= p.outputText;
		retval.selected= p.selected;
		return retval;
	}
	static radius=0;
	static distance=0;
	static updateParameters(nodeSize){
		//self-arc is a circle of radius r at distance d<R+r
		fsmSelfArc.radius=3/4*nodeSize;
		fsmSelfArc.distance=4/3*nodeSize;
	}

	draw(c){
		c.fillStyle=c.strokeStyle=this.isSelected()?'blue':'black';
		//let a=Math.acos(Math.sqrt(fsmSelfArc.radius**2-(fsmSelfArc.distance-nodeRadius)**2)/nodeRadius);
		let a=Math.acos( (0-nodeRadius**2+fsmSelfArc.radius**2+fsmSelfArc.distance**2)/(2*fsmSelfArc.radius*fsmSelfArc.distance));
		c.beginPath();
		let arcEnd=this.location.rotate(Math.PI-a).angle();
		let arcBegin=this.location.rotate(Math.PI+a).angle();
		c.arcAtCenter(this.referencePoint,fsmSelfArc.radius,arcBegin,arcEnd);
		c.stroke();
		let v=this.location.translateTo(this.location.to).normalize(fsmSelfArc.radius).rotate(Math.PI-a);
		c.arrowAtVector(v,nodeRadius/5,true,7*Math.PI/16);
		let text=this.inputText;
		if( this.outputText != "") 
			text=text+' / '+this.outputText ;
		c.fillTextAtVector(text,this.location.normalize(fsmSelfArc.distance+fsmSelfArc.radius),10);
	}
	containsPoint(pt) {
		if( distance(this.referencePoint,pt) < fsmSelfArc.radius+5 )
			return true;
		else
			return false;
	}
	get referencePoint(){
		return this.location.to;
	}
	set referencePoint(p){
		if( p === this.node.referencePoint ) p.y=p.y-1;
		this.location=new vector(this.node.referencePoint,p).normalize(fsmSelfArc.distance);
	}
	updateLocation(){
		this.referencePoint=this.location.translateTo(this.node.referencePoint).to;
	}
};
function nextStateName(){
	let inUse=fsmNodes.map(n => n.stateName);
	if( !inUse.every(a => a[0]=="S" && (a.length==2 || !isNaN(parseInt(a.substring(1))) )))
		return '';
	if( inUse.length==0 || inUse.every(a => !isNaN(parseInt(a.substring(1))))) 
		for( i=0; i<26; i++ )
			if( !inUse.includes("S"+i))
				return "S"+i;
	if( inUse.every(a => a[0]=="S" && a.length==2 && isNaN(parseInt(a.substring(1))))) 
		for( i=0; i<26; i++ )
			if( !inUse.includes("S"+String.fromCharCode(65+i)))
				return "S"+String.fromCharCode(65+i);
	return "";
}
class fsmNode extends fsmElement{
	constructor(p,stateName="",outputs=[]) {
		super(p);
		this.stateName= stateName==="" ? nextStateName(): stateName;
		this.mooreOutputs=outputs;
		this.fsmType="node";
	}
	backup(){
		return {
			'referencePoint':this.referencePoint,
			'stateName': this.stateName,
			'mooreOutputs': this.mooreOutputs,
			'selected': this.selected
		};
	}
	static from(json){
		let retval= new fsmNode( json.referencePoint, json.stateName, json.mooreOutputs);
		retval.selected= json.selected;
		return retval;
	}
	draw(c){
		c.strokeStyle=this.isSelected()?'blue':'black';
		c.beginPath();
		c.arcAtCenter(this.referencePoint, nodeRadius, 0, 2 * Math.PI);
		c.fillStyle='white';
		//c.fill();
		c.stroke();
		//state name
		c.textAlign="center";
		c.textBaseline="bottom";
		c.fillStyle=c.strokeStyle;
		c.fillTextAtPoint(this.stateName,this.referencePoint);
		//outputs
		if( this.mooreOutputs.length != 0){
			c.moveToPoint(this.referencePoint.minus({x:nodeRadius*.8,y:0}));
			c.lineToPoint(this.referencePoint.plus({x:nodeRadius*.8,y:0}));
			c.stroke();
			c.textBaseline="top";
			c.fillTextAtPoint(this.mooreOutputs,this.referencePoint.plus({x:0,y:2}));
		}
	}
	containsPoint(pt) {
		return( distance(pt,this.referencePoint) < nodeRadius);
	}
	set referencePoint(p){
		this.location.to=new point(p);
		if( document.getElementById("snapNode").checked){
			let snap=parseInt(document.getElementById("snapSize").value);
			this.location.to.x=Math.round(this.location.to.x/snap)*snap;
			this.location.to.y=Math.round(this.location.to.y/snap)*snap;
		}
		fsmArcs.filter(a => a.endNode==this || a.startNode==this).forEach( a => a.updateLocation());
		fsmSelfArcs.filter(a => a.node==this).forEach( a => a.updateLocation());
		fsmResetArcs.filter(a => a.node==this).forEach( a => a.updateLocation());
	}
	get referencePoint(){
		return this.location.to;
	}
}


function makeBackup() {
	let retval = {
		'nodeRadius': 0,
		'fontSize': 0,
		'fsmNodes': new Array(),
		'fsmArcs': new Array(),
		'fsmSelfArcs': new Array(),
		'fsmResetArcs': new Array()
	};
	retval.nodeRadius=nodeRadius;
	retval.fontSize=document.getElementById("fontSize").value;
	fsmNodes.forEach( n => retval.fsmNodes.push( n.backup() ));
	fsmArcs.forEach( a => retval.fsmArcs.push( a.backup() ));
	fsmSelfArcs.forEach( a => retval.fsmSelfArcs.push( a.backup() ));
	fsmResetArcs.forEach( a => retval.fsmResetArcs.push(a.backup()));
	return JSON.stringify(retval);
}
function restoreBackup(json){
	try{
		let state=JSON.parse(json);
		fsmNodes=[];
		fsmArcs=[];
		fsmSelfArcs=[];
		fsmResetArcs=[];
		nodeRadius=state.nodeRadius;
		fsmSelfArc.updateParameters(nodeRadius);
		document.getElementById("nodeSize").value=nodeRadius;
		document.getElementById("fontSize").value=state.fontSize;
		state.fsmNodes.forEach( n => fsmNodes.push( fsmNode.from(n)));
		state.fsmArcs.forEach( a => fsmArcs.push( fsmArc.from(a)));
		state.fsmSelfArcs.forEach( a => fsmSelfArcs.push( fsmSelfArc.from(a)));
		state.fsmResetArcs.forEach( a => fsmResetArcs.push( fsmResetArc.from(a)));
		return true;
	}catch(e){
		changeHistory.restore();
		return false;
	}
}

function drawOnCanvas(c) {
	c.font=document.getElementById("fontSize").value+'px monospace';	
	c.clearRect(0, 0, fsmCanvas.width, fsmCanvas.height);
	c.save();
	c.translate(0.5, 0.5);
	c.lineWidth = 1;

	fsmArcs.forEach( a=> a.draw(c));
	fsmSelfArcs.forEach( a=> a.draw(c));
	fsmResetArcs.forEach( a=>a.draw(c));
	fsmNodes.forEach( n=> n.draw(c));
	if( temporaryObject.fsmSubtype === "temporary" )
	{
		temporaryObject.draw(c);
	}
	if( selectionBox !== null ){
		selectionBox.draw(c);
	}
	c.restore();
	if( debug !== null ){
		c.textAlign="left";
		c.textBaseline="top";
		c.fillStyle='black';
		c.fillText(debug.toString(),30,30);
	}
}

function updateFSM() {
	drawOnCanvas(fsmCanvas.getContext('2d')); 
}
function selectAll(){
	fsmNodes.forEach( e => e.select() );
	fsmArcs.forEach( e => e.select() );
	fsmSelfArcs.forEach( e => e.select() );
	fsmResetArcs.forEach( e => e.select() );
}
function deselectAll(){
	fsmNodes.forEach( e => e.deselect() );
	fsmArcs.forEach( e => e.deselect() );
	fsmSelfArcs.forEach( e => e.deselect() );
	fsmResetArcs.forEach( e => e.deselect() );
}
/*Makes tool buttons act like radio buttons*/
function toolSelect(t)
{
	for( let e of document.getElementsByClassName("toolbtn")){
		e.classList.remove("toolbtnselected");
		if( e.id == t+"btn" )
			e.classList.add("toolbtnselected");
	}
	tool=t;
}
function deleteSelected(){
	let wasDeleted= fsmNodes.some( n => n.isSelected() );
	let aaaa=fsmNodes[0].isSelected();
	fsmNodes=fsmNodes.filter( n => !n.isSelected() );
	wasDeleted= wasDeleted || fsmArcs.some(a=> a.isSelected() || !fsmNodes.includes(a.startNode) || !fsmNodes.includes(a.endNode));
	fsmArcs=fsmArcs.filter(a=> !a.isSelected() && fsmNodes.includes(a.startNode) && fsmNodes.includes(a.endNode) );
	wasDeleted = wasDeleted || fsmSelfArcs.some(a=> a.isSelected() || !fsmNodes.includes(a.node) );
	fsmSelfArcs=fsmSelfArcs.filter(a=> !a.isSelected() && fsmNodes.includes(a.node) );
	wasDeleted = wasDeleted || fsmResetArcs.some(a=> a.isSelected() || !fsmNodes.includes(a.node) );
	fsmResetArcs=fsmResetArcs.filter(a=> !a.isSelected() && fsmNodes.includes(a.node) );
	if( wasDeleted )
	{
		localStorage['fsm'] = changeHistory.push();
		updateFSM();
	}
}

//Auto arrange selected nodes on circle having diameter equal to their mean distance
function autoArrange(){
	let nodes=fsmNodes.filter( n =>n.isSelected());
	let len=nodes.length;
	if( len < 2 )
		return;
	//center and radius of group of nodes
	let b=new boundingBox(nodes.map(n=>n.referencePoint));
	let center=b.centerPoint();
	let radius=Math.sqrt(b.height**2,b.width**2)/2;
	radius=Math.max(radius,2*nodeRadius);

	//find phase that most closely matches node grouping
	let angles=new Array();
	for( n of nodes ){
		let a= new vector(center,n.referencePoint).angle();
		let p= Math.abs(a % (Math.PI/(2*nodes.length)));
		let s= Math.round(a/(Math.PI/(2*nodes.length)));
		angles.push( {node:n, angle:a, phase:p,step: s});
	}
	angles=angles.sort((a,b)=> a.angle-b.angle);
	let index,smallest=Infinity;
	angles.forEach( (a,i)=>{
		if( a.phase < smallest ){
			smallest=a.phase;
			index=i;
		}
	});
	let v=new vector( center, center.plus({x:radius,y:0})).rotate(angles[index].step*Math.PI/(2*nodes.length));
	for( let i=0; i<nodes.length; i++ ){
		let ind=(i+index)%nodes.length;
		angles[ind].node.referencePoint=v.to;
		v=v.rotate(2*Math.PI/nodes.length);
	}
	fsmSelfArcs.filter(a => a.node.isSelected() ).forEach( a => a.referencePoint=new vector(center,a.node.referencePoint).scale(1.5).to);
	fsmArcs.filter(a => a.startNode.isSelected() ).forEach( a => {
			let v1=new vector(a.startNode.referencePoint,a.endNode.referencePoint);
			a.referencePoint=v1.normalize(nodeRadius/2).translateTo(v1.midpoint()).rotate(-Math.PI/2).to;
	});
	for ( a of fsmResetArcs ){
		let sa=fsmSelfArcs.find( sa=> sa.node == a.node);
		if( undefined === sa ){
			a.referencePoint= new vector(center,a.node.referencePoint).scale(1.5).to;
		}else{
			sa.referencePoint= new vector(center,a.node.referencePoint).scale(1.5).rotate(Math.PI/16).to;
			a.referencePoint= new vector(center,a.node.referencePoint).scale(1.5).rotate(-Math.PI/16).to;
		}
	}
}

function toggleMode(){
	let e=document.getElementById("togglemodebtn");
	let fsmDiv=document.getElementById("fsmdiv");
	let simulator=document.getElementById("simulator");
	if( currentMode=="simulate"){
		currentMode="edit";
		e.innerText="Simulate";
		e.title="Click to simulate current FSM";
		fsmdiv.style.display="";
		simulator.style.display="none";
		waveforms=null;
	}else{
		currentMode="simulate";
		e.innerText="Edit FSM";
		e.title="Click to end simulation and return to editing mode";
		fsmdiv.style.display="none";
		simulator.style.display="";
		simCanvas=document.getElementById("simcanvas");
		waveforms=new timingDiagram(simCanvas);
	}
}

function adjustCanvasForPixelRatio(canvas,width,height){
	const dpr = window.devicePixelRatio;
	let w=parseInt(canvas.style.width);
	let h=parseInt(canvas.style.height);
	canvas.width = width * dpr;
	canvas.height = height * dpr;
	canvas.getContext('2d').scale(dpr, dpr);
}
class mySignal{
	constructor(initial=0,final=0){
		this.edges=[];
		this.initial=initial;
		this.final=final;
	}
	valueAt(t){
		let ret=this.initial;
		this.edges.every( e=> {if(e.time<=t){ret=e.value; return true;} else return false;});
		return ret;
	}
	valueBefore(t){
		let ret=this.initial;
		this.edges.every( e=> {if(e.time<t){ret=e.value; return true;} else return false;});
		return ret;
	}
	addEdge(t,v="boolean"){
		if( this.edges.findIndex( e=>e.time==t) != -1 )
			return;
		let idx=this.edges.findIndex( e=>e.time>t);
		if( idx != -1 )
			this.edges[idx].time=t;
		else
			this.edges.push({time:t,value: v==="boolean"?(this.valueAt(t)+1)%2 : v});
	}
	edgeAfter(t,maxtime=Infinity){
		let idx=this.edges.findIndex( (e)=> e.time > t);
		return idx===-1 ? maxtime : this.edges[idx].time;
	}
	edgeBefore(t, mintime=-Infinity){
		let idx=this.edges.findLastIndex( (e)=> e.time < t);
		return idx===-1 ? mintime : this.edges[idx].time;
	}
	closestEdgeTo(t){
			return this.edges.reduce( (acc,ed)=> Math.abs(ed.time-t) < Math.abs(acc.time-t) ? ed : acc, {value:this.final,time:Infinity});
	}
	deleteEdgesWithin(t,epsilon){
		let numEdges=this.edges.length;
		this.edges = this.edges.filter( (e)=> Math.abs(e.time-t) > epsilon);
		return numEdges != this.edges.length;
	}
	* segments(starttime = 0, endtime = Infinity) {
		let next={prior:this.valueBefore(starttime), end:starttime,start: starttime, value:this.valueAt(starttime)}; 
		for( const [i, e] of this.edges.entries()){
			if( e.time > next.end && e.time < endtime ){
			      next.end=e.time;
			      let retval={prior:next.prior,start:next.start,end:next.end,value:next.value};
			      next.start=e.time;
			      next.prior=next.value;
			      next.value=e.value;
			      yield retval;
			}
		}
		next.end=endtime;
		yield next;
	}
}
class timingDiagram{
	constructor(canvas,width=800,sigpad=20,sigheight=20,cycles=10,linewidth=1,textpad=5){
		this.canvas=canvas;
		let thisDiagram=this;
		let ctx=this.canvas.getContext("2d");
		this.numCycles=cycles;
		this.textPad=textpad;
		this.sigPad=sigpad;
		this.sigHeight=sigheight;
		this.timeMarker=.5;
		this.sliderMoving=false;
		this.edgeMoving=null;
		this.inputSignals=new Array();
		let clk={name:document.getElementById("clocksignal").value,signal:new mySignal()};
		for( let i=0; i<2*this.numCycles+1; i++ ){
			clk.signal.addEdge(i);
		}
		this.inputSignals.push(clk);
		this.inputSignals.push({ name:document.getElementById("resetsignal").value, signal:new mySignal() });
		for( let i=1; i<=parseInt(document.getElementById("numberofinputsignals").value); i++ )
			this.inputSignals.push( { name:document.getElementById("inputsignal"+i).value, signal:new mySignal() });
		this.outputSignals=new Array();
		this.outputSignals.push( { name:"state", signal:new mySignal("undefined","undefined")});
		this.outputSignals.push( { name:"next state", signal:new mySignal("undefined","undefined") });
		for( let i=1; i<=parseInt(document.getElementById("numberofoutputsignals").value); i++ ){
		this.outputSignals.push({ name:document.getElementById("outputsignal"+i).value,signal:new mySignal("undefined","undefined")});
		}
		this.canvasHeight=(1+this.outputSignals.length+this.inputSignals.length)*(this.sigPad+this.sigHeight);
		this.canvasWidth=width;
		adjustCanvasForPixelRatio(canvas,width,this.canvasHeight );
		ctx.font=this.sigHeight.toString()+"px monospace";
		ctx.lineWidth=1;
		this.textWidth=2*this.sigPad+Math.max(...[this.inputSignals,this.outputSignals].flat().map(n => ctx.measureText(n.name).width));
		this.sigWidth=ctx.canvas.width/ctx.getTransform().a-this.textWidth-this.sigPad;
		this.signalArea=new boundingBox([new point(this.textWidth,sigpad),new point(width-sigpad,this.canvasHeight-sigpad)]);
		
		this.canvas.onmousedown = function(e){
			let mClkPt=getMousePosition(simCanvas,e);
			let pad=thisDiagram.sigPad;
			let left= thisDiagram.textWidth+thisDiagram.timeMarker*thisDiagram.sigWidth-pad/2;
			let top= thisDiagram.canvasHeight-1.5*pad;
			let {signal,x} = thisDiagram.signalAtPoint(mClkPt);
			if(mClkPt.x > left && mClkPt.x < left+pad &&mClkPt.y > top && mClkPt.y < top+pad)
				thisDiagram.sliderMoving=true;
			else if( signal != -1 ){
				if( signal < thisDiagram.inputSignals.length ){
					let sig=thisDiagram.inputSignals[signal].signal;
					let t=2*x*thisDiagram.numCycles;
					let nearestEdge=sig.closestEdgeTo(t);
					if( Math.abs(nearestEdge.time-t) < .1 ){
						let min=sig.edgeBefore(nearestEdge.time,.0001);
						let max=sig.edgeAfter(nearestEdge.time,2*thisDiagram.numCycles);
						thisDiagram.edgeMoving={edge:nearestEdge,max:max,min:min};
					}
				}
			}
		}
		this.canvas.onmouseout = function(e){
			thisDiagram.sliderMoving=false;
			thisDiagram.edgeMoving=null;
		}
		this.canvas.onmousemove = function(e){
			let mouseClickPoint=getMousePosition(simCanvas,e);
			if( thisDiagram.sliderMoving ){
				thisDiagram.timeMarker=Math.min(1,Math.max((mouseClickPoint.x-thisDiagram.textWidth)/thisDiagram.sigWidth,0));
				thisDiagram.redraw();
			}
			if( thisDiagram.edgeMoving != null ){
				let p=thisDiagram.signalArea.relativeCoordinatesOfPoint(mouseClickPoint);
				p.x=p.x*thisDiagram.numCycles*2;
				if( p.x >= .2+thisDiagram.edgeMoving.min && p.x <= thisDiagram.edgeMoving.max-.25 ){
					thisDiagram.edgeMoving.edge.time=p.x;
					thisDiagram.redraw();
				}
			}
		}
		this.canvas.onmouseup = function(e){
			if( thisDiagram.sliderMoving ){
					thisDiagram.sliderMoving=false;
			}else if( thisDiagram.edgeMoving){
					thisDiagram.edgeMoving=null;
			} else{
					let mouseClickPoint=getMousePosition(simCanvas,e);
					let {signal,x}=thisDiagram.signalAtPoint(mouseClickPoint);
					if( signal != -1 ){ 
						if( signal==0){ 
							thisDiagram.timeMarker=Math.round(px*thisDiagram.numCycles*2)/(2*thisDiagram.numCycles);
						}
						else if( signal < thisDiagram.inputSignals.length ){
							let t= (Math.abs(x-thisDiagram.timeMarker)<.01 ? thisDiagram.timeMarker :x)*2*thisDiagram.numCycles;
							let sig=thisDiagram.inputSignals[signal].signal;
							if( t == 0 )
								sig.initial = (sig.initial+1)%2;
							else if( t < 2*thisDiagram.numCycles && !sig.deleteEdgesWithin(t,.15)){
									sig.addEdge(t);
							}
						}else if( 0){
							//move nearby edge if exists
						}
					}
					thisDiagram.redraw();
			}
		}
		this.redraw();
	}
	signalAtPoint(pt){
		let ret={signal:-1,x:0};
		let pad=this.sigPad;
		let p=this.signalArea.relativeCoordinatesOfPoint(pt);
		if( p.x >= 0 || p.x <= 1 || p.y >= 0 || p.y <= 1 )
		{
				let numsig=(1+this.inputSignals.length+this.outputSignals.length);
				let y=p.y*numsig;
				let signalNum=Math.floor(y);
				let isOnSignal=(y-signalNum)*numsig>this.sigPad/(this.sigHeight+this.sigPad)/numsig;
				if( isOnSignal )
					ret.signal=signalNum;
				ret.x=p.x;
		}
		return ret;
	}
	drawSignal(c,signal,timescale,maxtime,isclock=false){
		c.textAlign="right";
		c.textBaseline="top";
		c.fillText(signal.name,-this.textPad,0);
		let sig=signal.signal;
		c.beginPath();
		let isFirst=true;
		for( let seg of sig.segments(0,this.numCycles*2)){
			let start= timescale * seg.start; 
			let end= timescale * seg.end; 
			let transition=timescale*.1;
			if( isclock )
				transition=0;
			if( !isFirst ){
				if( seg.prior==0 && seg.value!=1 || seg.prior !=1 && seg.value==0){
					c.moveTo(start,this.sigHeight);
					c.lineTo(start+transition,this.sigHeight);
				}
				if( seg.prior==1 && seg.value!=0 || seg.prior !=0 && seg.value==1){
					c.moveTo(start,0);
					c.lineTo(start+transition,0);
				}
				if( seg.prior!=1 && seg.value!=0 ){
					c.moveTo(start,this.sigHeight);
					c.lineTo(start+transition,0);
				}
				if( seg.prior!=0 && seg.value!=1){
					c.moveTo(start,0);
					c.lineTo(start+transition,this.sigHeight);
				}
				start=start+transition;
			}
			isFirst=false;
			//draw signal value
			if( seg.value != 1 ){
				c.moveTo(start,this.sigHeight);
				c.lineTo(end, this.sigHeight);
			}
			if( seg.value != 0 ){
				c.moveTo(start,0);
				c.lineTo(end, 0);
			}
			//draw value
			if( seg.value != 0 && seg.value != 1 ){
				c.textAlign="center";
				c.textBaseline="top";
				c.fillText(seg.value,(start+end)/2,0);
			}
		}
		c.stroke();
	}
	redraw(){
		let c=this.canvas.getContext("2d");
		c.clearRect(0, 0, c.canvas.width, c.canvas.height);
		c.fillStyle=c.strokeStyle="black";
		c.lineWidth = 1;
		this.textWidth=2*this.sigPad+Math.max(...[this.inputSignals,this.outputSignals].flat().map(n => c.measureText(n.name).width));
		[this.inputSignals, this.outputSignals].flat().forEach( (s,i) => {
			c.save();
			c.translate( this.textWidth, this.sigPad+ (i)*(this.sigHeight+this.sigPad));
			this.drawSignal(c, s, this.sigWidth/(2*this.numCycles),this.numCycles*2, i==0 ? true : false);
			c.restore();
		});
		c.beginPath();
		let timeMarkerX=this.textWidth+this.timeMarker*this.sigWidth;
		c.moveTo(timeMarkerX,this.sigPad/2);
		c.strokeStyle="#FFFF0080";
		c.lineWidth=2;
		c.lineTo(timeMarkerX,this.canvasHeight-this.sigPad/2);
		c.stroke();
		c.fillStyle="yellow";
		c.fillRect(timeMarkerX-this.sigPad/2, this.canvasHeight-1.5*this.sigPad, this.sigPad, this.sigPad);
	}
}
window.onload = function() {
	/***********************************************************************************
	 *Editor
	 ***********************************************************************************/
	let needToSaveHistory=false;
	currentMode="edit";
	changeHistory= new history( makeBackup, restoreBackup);
	fsmCanvas = document.getElementById('fsmcanvas');
	adjustCanvasForPixelRatio(fsmCanvas,800,600);
	//document.getElementById("welcomeModal").showModal();
	let toggleButton=document.getElementById("togglemodebtn");
	toggleButton.onclick=toggleMode;
	var newButton=new myButton("filetoolbuttons","newbtn","toolbtn","New FSM","Erase all and start new FSM", function(e){
		selectAll();
		deleteSelected();
	});
	var arcButton=new myButton("tooltoolbuttons","arcbtn","toolbtn","Arc Tool","Selects the arc drawing tool",function(e){
		toolSelect("arc");
	});
	var nodeButton=new myButton("tooltoolbuttons","nodebtn","toolbtn","Node Tool","Selects the node drawing tool",function(e){
		toolSelect("node");
	});
	var selectButton=new myButton("tooltoolbuttons","selectbtn","toolbtn","Select Tool","Selection tool",function(e){
		toolSelect("select");
	});
	var deleteButton=new myButton("edittoolbuttons","deletebtn","utilbtn","Delete","Delete selected FSM elements", deleteSelected );
	var undoButton=new myButton("edittoolbuttons","undobtn","utilbtn","Undo","Undo changes",function(e){
		localStorage['fsm'] = changeHistory.undo();
		updateFSM();
	});
	var redoButton=new myButton("edittoolbuttons","redobtn","utilbtn","Redo","Redo undone changes",function(e){
		localStorage['fsm'] = changeHistory.redo();
		updateFSM();
	});
	var arrangeButton=new myButton("edittoolbuttons","arrangebtn","utilbtn","Arrange","Auto-arrange selected FSM nodes",function(e){
		autoArrange();
		localStorage['fsm'] = changeHistory.push();
		updateFSM();
	});
	var exportImageButton=new myButton("filetoolbuttons","exportbtn","utilbtn","Export PNG","Export image of FSM in PNG format",function(e){
		let b=makeBackup();
		deselectAll();
		updateFSM();
		let cUrl = fsmCanvas.toDataURL();
		const a = document.createElement('a');
		a.href = cUrl;
		a.download = "fsm";
		a.click();
		URL.revokeObjectURL(a.href);
		a.remove();
		restoreBackup(b);
		updateFSM();
	});
	var saveFileButton=new myButton("filetoolbuttons","savefilebtn","utilbtn","Save File","Save current FSM design to a text file",function(e){
	    let a = document.createElement("a");
	    let file = new Blob([makeBackup()], {type:"text/plain" });
	    a.href = URL.createObjectURL(file);
	    a.download = "fsm.txt";
	    a.click();
	    URL.revokeObjectURL(a.href);
	    a.remove();
	});
	var loadFileButton=new myButton("filetoolbuttons","loadfilebtn","utilbtn","Load File","Load a previously saved FSM from a text file",function(e){
		var input = document.createElement('input');
		input.type = 'file';
		input.onchange = e => { 
			var file = e.target.files[0];
			if (!file) return;
			var reader = new FileReader();
			reader.onload = function(e) {
				var contents = e.target.result;
				if( restoreBackup(contents) ){
					changeHistory.push("file load");
					updateFSM();
				}
			};
			reader.readAsText(file);
		}
		input.click();
	});
	var helpButton=new myButton("helptoolbuttons","helpfilebtn","utilbtn","Help","Click to read help file",function(e){
		document.getElementById("helpModal").showModal();
	});
	//property editor
	var propertyEditor=document.getElementById("propertyedit");
	var subjectOfPropertyEditor=new fsmElement();
	function openPropertyEditor(){
		if( subjectOfPropertyEditor.fsmtype==="none" || subjectOfPropertyEditor.fsmSubtype==="temporary")
			return;
		let property1=propertyEditor.querySelector('input[id="property1"]');
		let property2=propertyEditor.querySelector('input[id="property2"]');
		if( subjectOfPropertyEditor.fsmType === "node" ){
			property1.labels[0].textContent="Node Name";
			property2.labels[0].textContent="Moore Outputs";
			property1.value=subjectOfPropertyEditor.stateName;
			property2.value=subjectOfPropertyEditor.mooreOutputs;
		}else if( subjectOfPropertyEditor.fsmType === "arc" ){
			property1.labels[0].textContent="Arc Condition";
			property2.labels[0].textContent="Arc Outputs";
			property1.value=subjectOfPropertyEditor.inputText;
			property2.value=subjectOfPropertyEditor.outputText;
			if( subjectOfPropertyEditor.fsmSubtype != "none" )
				property2.style.display="none";
			else
				property2.style.display="";
		}
		deselectAll();
		subjectOfPropertyEditor.select();
		propertyEditor.style.display="block";
		if( subjectOfPropertyEditor.referencePoint.y > fsmCanvas.height/2 )
			propertyEditor.style.top=(subjectOfPropertyEditor.referencePoint.y-nodeRadius/2-propertyEditor.offsetHeight).toString()+"px";
		else
			propertyEditor.style.top=(subjectOfPropertyEditor.referencePoint.y+nodeRadius/2).toString()+"px";
		if( subjectOfPropertyEditor.referencePoint.x > fsmCanvas.width/2 )
			propertyEditor.style.left=(subjectOfPropertyEditor.referencePoint.x-nodeRadius/2-propertyEditor.offsetWidth).toString()+"px";
		else
			propertyEditor.style.left=(subjectOfPropertyEditor.referencePoint.x+nodeRadius/2).toString()+"px";
			
			
		property1.focus();
		property1.setSelectionRange(0, property1.value.length);
	}
	function propertyEditorUpdate(e){
		let property1=propertyEditor.querySelector('input[id="property1"]');
		let property2=propertyEditor.querySelector('input[id="property2"]');
		let confirm=propertyEditor.querySelector('button[id="confirmproperty"]');
		let dirty=false;
		if( e.type === "keydown" && e.code==="Escape"){
			propertyEditor.style.display="none";
			subjectOfPropertyEditor=new fsmElement();
		}else if( e.type === "keydown" && e.code==="Tab" && e.target.id==="confirmproperty" && !e.shiftKey){
			e.preventDefault();
			property1.focus();
		}else if( e.type === "keydown" && e.code==="Tab" && e.target.id==="property1" && e.shiftKey ){
			e.preventDefault();
			confirm.focus();
		}else if( e.target.id==="confirmproperty" && e.type=="click" || e.type==="keydown" && e.code==="Enter" ){
			if( subjectOfPropertyEditor.fsmType === "node" ){
				if( property1.value !==subjectOfPropertyEditor.stateName){
					dirty=true;
					subjectOfPropertyEditor.stateName=property1.value;//.slice();
				}
				if( property2.value !==subjectOfPropertyEditor.mooreOutputs){
					dirty=true;
					subjectOfPropertyEditor.mooreOutputs=property2.value;//.slice();
				}
			}else if( subjectOfPropertyEditor.fsmType === "arc" ){
				if( property1.value !==subjectOfPropertyEditor.inputText){
					dirty=true;
					subjectOfPropertyEditor.inputText=property1.value;//.slice();
				}
				if( property2.value !==subjectOfPropertyEditor.outputText){
					dirty=true;
					subjectOfPropertyEditor.outputText=property2.value;//.slice();
				}
			}
			if( dirty ){
					localStorage['fsm'] = changeHistory.push();
					updateFSM();
			}
			propertyEditor.style.display="none";
				subjectOfPropertyEditor=new fsmElement();
		}
	}
	propertyEditor.style.display="none";
	propertyEditor.onclick= propertyEditorUpdate;
	propertyEditor.onkeydown= propertyEditorUpdate;
	let nodeSize=document.getElementById("nodeSize");
	nodeSize.addEventListener("input",function(e)
	{
		nodeRadius=e.currentTarget.value;
		fsmSelfArc.updateParameters(nodeRadius);
		fsmArcs.forEach( a => a.updateLocation());
		fsmSelfArcs.forEach( a => a.updateLocation());
		fsmResetArcs.forEach( a => a.updateLocation());
		updateFSM();
		localStorage['fsm'] = changeHistory.push("node size");
	});
	nodeRadius=nodeSize.value;
	let fontSize=document.getElementById("fontSize");
	fontSize.addEventListener("input",function(e)
	{
		updateFSM();
		localStorage['fsm'] = changeHistory.push("font size");
	});
	fsmSelfArc.updateParameters(nodeRadius);
	toolSelect("select");
	try{
		restoreBackup(localStorage['fsm']);
	}catch{}
	fsmSelfArc.updateParameters(nodeRadius);
	temporaryObject= new fsmElement(); 
	selectedObject= new fsmElement(); 
	updateFSM();
	changeHistory.push();
	var mouseClick={count:0,time:0,state:"out"};
	fsmCanvas.onmouseout = function(e) {
		mouseClick={count:0,time:0,state:"out"};
		temporaryObject= new fsmElement(); 
		selectedObject= new fsmElement(); 
		selectionBox=null;
		selectionOffset=zeroPoint;
		if( document.activeElement.parentElement != propertyEditor)
		{
			subjectOfPropertyEditor=new fsmElement();
			propertyEditor.style.display="none";
		}
		if( needToSaveHistory )
			changeHistory.restore();
		updateFSM();
	}
	fsmCanvas.onmousedown = function(e) {
		mouseClick.state="down";
		selectionOffset=zeroPoint;

		let clickPoint = getMousePosition(fsmCanvas,e);
		objectAtClickPoint = locateObjectAt(clickPoint);

		//editor open bu we clicked outside
		if(subjectOfPropertyEditor.fsmType !== "none"){
			subjectOfPropertyEditor=new fsmElement();
			propertyEditor.style.display="none";
		} else if( tool == "arc"){
			deselectAll();
			if( objectAtClickPoint.fsmType === "none" ){
				temporaryObject = new temporaryArc({n:null, p:clickPoint});
			}else{
				if(objectAtClickPoint.fsmType === "node") {
					temporaryObject = new temporaryArc({n:objectAtClickPoint, p:clickPoint});
				}else if( objectAtClickPoint.fsmType == "arc" ){
					selectedObject=objectAtClickPoint;
					selectionOffset=objectAtClickPoint.referencePoint.minus(clickPoint);
					objectAtClickPoint.select();
				}
			}
		} else if( tool=="node" ){
			deselectAll();
			if( objectAtClickPoint.fsmType==="none" ){
				fsmNodes.push(new fsmNode(clickPoint));
				localStorage['fsm'] = changeHistory.push();
			}else if( objectAtClickPoint.fsmType === "node"){
				selectedObject=objectAtClickPoint;
				selectionOffset=objectAtClickPoint.referencePoint.minus(clickPoint);
				objectAtClickPoint.select();
			}
		} else if( tool=="select" && objectAtClickPoint.fsmType !== "none"){
			if( !multiSelect ){
				deselectAll();
				objectAtClickPoint.select();
				selectedObject=objectAtClickPoint; 
				selectionOffset=objectAtClickPoint.referencePoint.minus(clickPoint);
			}else{
				objectAtClickPoint.select();
				selectedObject=new fsmElement();
				selectionOffset=clickPoint;
			}
		} else if( tool=="select" ){
			multiSelect=true;
			selectionBox=new selectionRectangle(clickPoint,clickPoint);
		} else{//TODO SHould never happen
			deselectAll();
		}
		updateFSM();
	};


	fsmCanvas.onmousemove = function(e) {
		if( mouseClick.state != "down" ) return; //only dragging operations
		mouseClick.count=0;
		mouseClick.time=0;
		let mouse = getMousePosition(fsmCanvas,e);
		if(temporaryObject.fsmType !== "none") {
			temporaryObject.referencePoint=mouse.plus(selectionOffset);
			updateFSM();
		}else if( selectionBox !== null ){
			selectionBox.end=mouse;
			let a=[fsmNodes,fsmArcs,fsmResetArcs,fsmSelfArcs].flat().forEach( x => {
				if( x.selected=='f' && selectionBox.contains(x.referencePoint))
					x.selected='p';
				else if( x.selected == 'p' && !selectionBox.contains(x.referencePoint))
					x.selected='f';
			});
			updateFSM();
		}else if( selectedObject.fsmType !== "none"){
			selectedObject.referencePoint=mouse.plus(selectionOffset);
			needToSaveHistory=true;
			updateFSM();
		} else if( multiSelect ){ //selectionOffset !==null ){
			let nodesMoved=false;
			for( n of fsmNodes ){
				if( n.isSelected() ){
					n.referencePoint=n.referencePoint.plus( new vector(selectionOffset,mouse).translateTo(zeroPoint).to);
					nodesMoved=true;
				}
			}
			selectionOffset=mouse;
			needToSaveHistory=true;
			updateFSM();
		}
	};

	fsmCanvas.onmouseup = function(e) {
		selectionOffset=null;
		mouseClick.state="up";
		let clickTime=Date.now();
		let deltaClick=clickTime-mouseClick.time;
		if(mouseClick.count==1 && deltaClick < 350){ //double click
			debug=deltaClick;
			mouseClick.count=0;
			mouseClick.time=0;
			if( tool ===selectedObject.fsmType || tool==="select" && selectedObject.fsmType !== "none" ){
					subjectOfPropertyEditor=selectedObject;
					selectedObject=new fsmElement();
					openPropertyEditor();
			}else if( selectedObject.fsmType === "none" ){
				document.getElementById("fsmproperties").showModal();
			}
		}else{ 
			mouseClick.count=1;
			mouseClick.time=Date.now();
			if( temporaryObject.fsmType !== "none" ) { 
				var mousePosition = getMousePosition(fsmCanvas,e);
				if( temporaryObject instanceof temporaryArc && (endNode=locateObjectAt(mousePosition)) instanceof fsmNode ){
					if( temporaryObject.node === null ){ //reset arc
						if( fsmResetArcs.length == 0 ){
							fsmResetArcs.push(new fsmResetArc(temporaryObject,endNode));
						}
					}else if( endNode == temporaryObject.node){ 
						if( fsmSelfArcs.every(a => !(a.node==endNode))){ //self arc
							fsmSelfArcs.push( new fsmSelfArc(temporaryObject));
							needToSaveHistory=true;
						}
					}else{
						if( fsmArcs.every(a => !(a.endNode==endNode && a.startNode==temporaryObject.node ) )) { //arc
							fsmArcs.push( new fsmArc(temporaryObject.node, endNode ));
							needToSaveHistory=true;
						}
					}
				}
				temporaryObject=new fsmElement();
			}else if( selectedObject.fsmType !== "none" ){
				selectedObject=new fsmElement();
				selectionOffset=null;
			}else if( selectionBox !== null ){
				if( [fsmArcs,fsmResetArcs,fsmSelfArcs,fsmNodes].flat().every( n=> !selectionBox.contains(n.referencePoint))){
					multiSelect=false;
					deselectAll();
				}
				for( el of [fsmArcs,fsmResetArcs,fsmSelfArcs,fsmNodes].flat()){
					if( el.selected=='p') 	
						el.setSelected('t');
				};
				selectionBox=null;
				updateFSM();
			}
			if( needToSaveHistory ){
				localStorage['fsm'] = changeHistory.push();
				needToSaveHistory=false;
			}
			updateFSM();
		}
	};
}
